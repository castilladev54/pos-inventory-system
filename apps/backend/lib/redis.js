// ⚠️ DEBE ser el primer import: carga .env antes que cualquier otro módulo
import "dotenv/config";

import { Redis } from "@upstash/redis";
import { getCurrentLogger } from "./logger.js";

// ─── Cliente Upstash Redis (Singleton) ───────────────────────────────────────
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// TTL por defecto: 1 hora (en segundos)
const DEFAULT_TTL = 3600;

const inFlightPromises = new Map();

/**
 * Obtiene datos del caché o ejecuta la función y guarda el resultado.
 * @param {string}   key        - Clave del caché (ej: "categories:userId123")
 * @param {Function} fn         - Función async que obtiene datos de MongoDB
 * @param {number}   [ttl=3600] - Tiempo de vida en segundos (default: 1 hora)
 * @returns {{ data: any, fromCache: boolean }}
 */
export const getOrSetCache = async (key, fn, ttl = DEFAULT_TTL) => {
  try {
    // 1. Intentar obtener del caché
    const cached = await redis.get(key);
    if (cached) {
      // Upstash deserializa automáticamente — no se necesita JSON.parse
      return { data: cached, fromCache: true };
    }

    // 2. Cache Stampede Prevention: Si hay una promesa en vuelo, esperarla
    if (inFlightPromises.has(key)) {
      const freshData = await inFlightPromises.get(key);
      return { data: freshData, fromCache: false };
    }

    // 3. Miss: ejecutar la consulta a MongoDB guardando la promesa
    const promise = fn().then(async (freshData) => {
      // Guardar el objeto directamente
      await redis.set(key, freshData, { ex: ttl }).catch(err => getCurrentLogger().error({ err }, "Redis set error"));
      return freshData;
    }).finally(() => {
      inFlightPromises.delete(key);
    });

    inFlightPromises.set(key, promise);
    const freshData = await promise;

    return { data: freshData, fromCache: false };
  } catch (error) {
    // Fail-open: si Redis falla, no romper la app
    getCurrentLogger().error({ err: error }, "Redis cache error");
    const freshData = await fn();
    return { data: freshData, fromCache: false };
  }
};

/**
 * Invalida (elimina) una o varias claves del caché.
 * @param {...string} keys - Claves a invalidar
 */
export const invalidateCache = async (...keys) => {
  try {
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    getCurrentLogger().error({ err: error }, "Redis invalidation error");
  }
};

// ─── SISTEMA DE VERSIONADO PARA INVALIDACIÓN POR PREFIJO ────────────────────
// Upstash REST no soporta SCAN/KEYS. No podemos borrar "products:p1:*".
// Solución: cada prefijo tiene un contador de versión (ej: "v:products:userId123").
// Las claves de caché incluyen la versión: "products:v3:p1:l20:userId123".
// Al incrementar la versión, todas las claves viejas (v2) se auto-invalidan
// sin necesidad de borrarlas — simplemente expiran por TTL natural.

/**
 * Obtiene la versión actual de un prefijo de caché.
 * @param {string} prefix - Prefijo base (ej: "products")
 * @param {string} userId - ID del usuario
 * @returns {number} Versión actual (0 si no existe)
 */
export const getCacheVersion = async (prefix, userId) => {
  try {
    const version = await redis.get(`v:${prefix}:${userId}`);
    return version || 0;
  } catch {
    return 0;
  }
};

/**
 * Incrementa la versión de un prefijo, invalidando todas las claves paginadas
 * anteriores sin necesidad de borrarlas una por una.
 * @param {string} prefix - Prefijo base (ej: "products")
 * @param {string} userId - ID del usuario
 */
export const bumpCacheVersion = async (prefix, userId) => {
  try {
    await redis.incr(`v:${prefix}:${userId}`);
  } catch (error) {
    getCurrentLogger().error({ err: error }, "Redis version bump error");
  }
};

/**
 * Construye una clave de caché versionada para paginación.
 * @param {string} prefix  - "products"
 * @param {number} version - Versión actual del prefijo
 * @param {number} page    - Página
 * @param {number} limit   - Límite por página
 * @param {string} userId  - ID del usuario
 * @returns {string} ej: "products:v3:p1:l20:userId123"
 */
export const buildPaginatedKey = (prefix, version, page, limit, userId) => {
  return `${prefix}:v${version}:p${page}:l${limit}:${userId}`;
};

/**
 * Recupera la versión de caché de la sucursal de forma pasiva (O(1)).
 * Nunca escribe en la base de datos para evitar race conditions.
 * @param {string} prefix - Prefijo base (ej: "products")
 * @param {string} ownerId - ID del inquilino
 * @param {string} branchId - ID de la sucursal
 * @returns {Promise<number>}
 */
export const getBranchCacheVersion = async (prefix, ownerId, branchId) => {
  try {
    const key = `v:${prefix}:${ownerId}:${branchId}`;
    const version = await redis.get(key);
    return version ? parseInt(version, 10) : 1;
  } catch (error) {
    getCurrentLogger().error({ error, ownerId, branchId }, 'Fallo al leer versión de Redis. Retornando fallback.');
    return 1; // Fallback tolerante a fallos de caché
  }
};

/**
 * Invalida la caché de una sucursal incrementando su versión (O(1)).
 * Implementa retry con backoff para absorber microcortes de red transitorios.
 * @param {string} prefix - Prefijo base
 * @param {string} ownerId - ID del inquilino
 * @param {string} branchId - ID de la sucursal
 * @returns {Promise<void>}
 */
export const bumpBranchCacheVersion = async (prefix, ownerId, branchId) => {
  const key = `v:${prefix}:${ownerId}:${branchId}`;
  
  const tryIncr = async (attempt = 1) => {
    try {
      await redis.incr(key);
    } catch (error) {
      if (attempt === 1) {
        await new Promise(res => setTimeout(res, 100));
        return tryIncr(2);
      } else if (attempt === 2) {
        await new Promise(res => setTimeout(res, 500));
        return tryIncr(3);
      } else {
        getCurrentLogger().error({ error, ownerId, branchId }, 'Fallo definitivo al invalidar caché en Redis tras reintentos.');
      }
    }
  };
  
  await tryIncr();
};
