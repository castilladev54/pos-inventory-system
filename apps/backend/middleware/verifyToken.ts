import jwt, { type JwtPayload } from "jsonwebtoken";
import { redis } from "../lib/redis.js";
import { User } from "../models/User.js";
import type { Request, Response, NextFunction } from "express";
import { getCurrentLogger } from "../lib/logger.js";

// ─── Interfaz del payload decodificado del JWT ──────────────────────────────
interface DecodedToken extends JwtPayload {
  userId: string;
  tokenVersion?: number;
  role?: string;
  permissions?: string[];
  ownerId?: string | null;
  assignedBranches?: string[];
}

// ─── OPTIMIZACIÓN CRÍTICA ───────────────────────────────────────────────────
// Leer el secreto UNA SOLA VEZ al cargar el módulo.
const JWT_SECRET = process.env.JWT_SECRET as string;

// ─── CLASE DE CACHÉ ACOTADO LRU (CERO DEPENDENCIAS) ─────────────────────────
class BoundedCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number): void {
    // Si existe, lo borramos para que la reinserción lo mande al final de la cola (LRU behavior)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Si excede el tamaño máximo, desaloja el elemento más antiguo (O(1))
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

const fallbackCache = new BoundedCache<string, string>(1000);

// ─── MÁQUINA DE ESTADOS DEL CIRCUIT BREAKER ────────────────────────────────
class RedisCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastStateChange = 0;
  private readonly threshold = 5;
  private readonly cooldownMs = 30000; // 30 segundos de cooldown

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  shouldAttempt(): boolean {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now - this.lastStateChange > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.lastStateChange = now;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }
}

const circuitBreaker = new RedisCircuitBreaker();

// ─── MIDDLEWARE DE VERIFICACIÓN DE TOKEN ─────────────────────────────────────
export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  // Validar que el header exista y tenga el formato correcto (Bearer <token>)
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  // Usar la versión con callback de jwt.verify para liberar el Event Loop
  jwt.verify(token, JWT_SECRET, async (error, decoded) => {
    if (error) {
      if (error.name === "TokenExpiredError") {
        res.status(401).json({ success: false, message: "Unauthorized - Token expired" });
        return;
      }
      if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
        res.status(401).json({ success: false, message: "Unauthorized - invalid token" });
        return;
      }
      getCurrentLogger().error({ err: error }, "Unexpected error in verifyToken");
      res.status(500).json({ success: false, message: "Server error" });
      return;
    }

    if (!decoded) {
      res.status(401).json({ success: false, message: "Unauthorized - invalid token" });
      return;
    }

    const payload = decoded as DecodedToken;
    req.userId = payload.userId;

    // ─── CONTROL DE PUNTOS CIEGOS: Metadata stateless del token ─────────────
    const hasMetadata =
      payload.role !== undefined &&
      payload.permissions !== undefined &&
      payload.ownerId !== undefined &&
      payload.assignedBranches !== undefined &&
      payload.tokenVersion !== undefined;

    if (!hasMetadata) {
      // Fallback: retro-compatibilidad con tokens emitidos antes de la migración stateless.
      req.userMetadata = null;
    } else {
      req.userMetadata = {
        role: payload.role!,
        permissions: payload.permissions!,
        ownerId: payload.ownerId ?? null,
        assignedBranches: payload.assignedBranches!,
      };
    }

    // ─── CONTROL DE VERSIÓN DE TOKEN (Resiliente con Circuit Breaker y Caché Local) ───
    try {
      let redisVersion: string | null = null;
      let usedRedis = false;

      if (circuitBreaker.shouldAttempt()) {
        try {
          redisVersion = await redis.get(`tokenVersion:${payload.userId}`) as string | null;
          circuitBreaker.recordSuccess();
          usedRedis = true;
        } catch (redisError: unknown) {
          getCurrentLogger().warn({ err: redisError }, "Redis connection error, recording failure in Circuit Breaker");
          circuitBreaker.recordFailure();
        }
      }

      if (redisVersion === null) {
        // Intentar leer del caché local acotado para proteger MongoDB contra avalanchas
        const cachedVersion = fallbackCache.get(payload.userId);
        if (cachedVersion !== null) {
          redisVersion = cachedVersion;
        } else {
          // Fallback seguro a DB
          const user = await User.findById(payload.userId).select('tokenVersion').lean();

          if (!user) {
            res.status(403).json({ success: false, message: "Access revoked. User account has been deleted." });
            return;
          }

          redisVersion = ((user as { tokenVersion?: number }).tokenVersion ?? 0).toString();
          // Guardar en caché local durante 30 segundos
          fallbackCache.set(payload.userId, redisVersion, 30000);

          // Si Redis está en estado CLOSED/HALF_OPEN pero tuvimos un cache miss, repoblamos
          if (usedRedis) {
            try {
              await redis.set(`tokenVersion:${payload.userId}`, redisVersion, { ex: 604800 });
            } catch (redisError: unknown) {
              getCurrentLogger().error({ err: redisError }, "Redis populate error in verifyToken");
            }
          }
        }
      }
      if (payload.tokenVersion === undefined || String(payload.tokenVersion) !== String(redisVersion)) {
        res.status(403).json({ success: false, message: "Session invalidated." });
        return;
      }
    } catch (error: unknown) {
      getCurrentLogger().error({ err: error }, "Critical error in verifyToken check");
      res.status(500).json({ success: false, message: "Internal server error during authentication." });
      return;
    }

    next();
  });
};
