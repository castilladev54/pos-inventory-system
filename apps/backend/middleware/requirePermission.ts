import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { User, ROLES, type Role } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { BusinessOwnerId, ActorId, BranchId } from '../types/brands.js';
import { getCurrentLogger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const OBJECTID_REGEX = /^[0-9a-fA-F]{24}$/;
const TENANT_BRANCHES_TTL = 86400; // 24 horas en segundos
const SENTINEL_EMPTY = '__empty__';

/**
 * Middleware Global para rutas protegidas.
 * Obtiene el contexto del negocio e inyecta req.businessOwnerId y req.actorId.
 * También inyecta req.branchId si viene en el header 'x-branch-id'.
 * Garantía de seguridad: todas las queries downstream usan businessOwnerId como tenant-filter.
 *
 * Zero-Trust Gateway:
 *   1. Barrera HPP (HTTP Parameter Pollution)
 *   2. Barrera Regex (24-char Hex estricto, impide inyección de Sentinel)
 *   3. Cache-Aside con Sentinel (__empty__) para prevenir Cache Stampede
 */
export const injectBusinessContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const meta = req.userMetadata;

    // Si el token es autocontenido y tiene la metadata, resolvemos de forma 100% STATELESS
    if (meta && meta.role !== undefined) {
      req.realUserId = req.userId;
      req.userRole = meta.role as Role;
      req.userPermissions = meta.permissions || [];
      req.assignedBranches = meta.assignedBranches || [];

      // Si tiene ownerId es un empleado, de lo contrario él mismo es el dueño del negocio
      const ownerIdStr = meta.ownerId ? meta.ownerId : req.userId;
      req.businessOwnerId = ownerIdStr as unknown as BusinessOwnerId;
      req.actorId = req.userId as unknown as ActorId;
    } else {
      // Fallback de producción: retro-compatibilidad con tokens pre-migración.
      const user = await User.findById(req.userId).lean();
      if (!user) {
        res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
        return;
      }

      req.realUserId = user._id.toString();
      req.userRole = user.role as Role;
      req.userPermissions = (user.permissions as string[]) || [];
      req.assignedBranches = ((user.assigned_branches as Types.ObjectId[]) || []).map(id =>
        id.toString()
      );

      const ownerRawId = user.owner_id
        ? (user.owner_id as Types.ObjectId)
        : (user._id as Types.ObjectId);

      req.businessOwnerId = ownerRawId as unknown as BusinessOwnerId;
      req.actorId = (user._id as Types.ObjectId) as unknown as ActorId;
    }

    // ─── ZERO-TRUST GATEWAY ────────────────────────────────────────────────
    const headerValue = req.headers['x-branch-id'];

    if (headerValue !== undefined) {
      // 1. Barrera contra HTTP Parameter Pollution (HPP)
      //    Express convierte múltiples headers homónimos en un array. Rechazamos esto.
      if (typeof headerValue !== 'string') {
        res.status(400).json({
          success: false,
          code: 'ERR_HEADER_HPP',
          message: 'Formato de cabecera x-branch-id inválido (Múltiples valores).',
        });
        return;
      }

      // 2. Barrera Estructural Estricta (Regex Hex 24 chars)
      //    Previene: falsos positivos de Mongoose (casteo legado de 12 bytes)
      //              e inyección del Sentinel (__empty__).
      if (!OBJECTID_REGEX.test(headerValue)) {
        res.status(400).json({
          success: false,
          code: 'ERR_BRANCH_FORMAT',
          message: 'Formato de Sucursal Inválido.',
        });
        return;
      }

      req.branchId = new Types.ObjectId(headerValue) as unknown as BranchId;
      const branchIdStr = headerValue;

      // 3. Validación de Jurisdicción por Rol
      if (req.userRole === ROLES.EMPLOYEE) {
        // ─── Empleados: validación explícita contra assigned_branches (JWT) ──
        const isAuthorized = req.assignedBranches?.some(
          (id) => id.toString() === branchIdStr
        );
        if (!isAuthorized) {
          res.status(403).json({
            success: false,
            code: 'ERR_BRANCH_JURISDICTION',
            message: 'Acceso denegado. Jurisdicción de sucursal inválida o manipulada.',
          });
          return;
        }
      } else if (req.userRole === ROLES.TENANT_OWNER || req.userRole === ROLES.ADMIN) {
        // ─── Dueños/Admins: Gateway O(1) con Redis Cache-Aside ──────────────
        const redisKey = `tenant:branches:${req.businessOwnerId}`;

        try {
          const exists = await redis.exists(redisKey);

          if (exists === 1) {
            // Cache Hit: validación O(1)
            const isMember = await redis.sismember(redisKey, branchIdStr);
            if (!isMember) {
              res.status(403).json({
                success: false,
                code: 'ERR_BRANCH_JURISDICTION',
                message: 'Jurisdicción inválida. La sucursal no pertenece a tu tenant.',
              });
              return;
            }
          } else {
            // Cache Miss: Hidratación Atómica (Read-Through)
            const branches = await Branch.find({ owner_id: req.businessOwnerId })
              .select('_id')
              .lean();
            const branchIds = branches.map(b => b._id.toString());

            // Null Object Pattern (Sentinel): cachear el estado vacío para prevenir Cache Stampede
            const valuesToStore = branchIds.length > 0 ? branchIds : [SENTINEL_EMPTY];

            const pipeline = redis.pipeline();
            pipeline.sadd(redisKey, ...(valuesToStore as [string, ...string[]]));
            pipeline.expire(redisKey, TENANT_BRANCHES_TTL);
            await pipeline.exec();

            // Evaluación Post-Hidratación (contra el array fresco de MongoDB, no contra Redis)
            if (!branchIds.includes(branchIdStr)) {
              res.status(403).json({
                success: false,
                code: 'ERR_BRANCH_JURISDICTION',
                message: 'Jurisdicción inválida. La sucursal no pertenece a tu tenant.',
              });
              return;
            }
          }
        } catch (redisError) {
          // Fail-Open ante fallo de Redis: degradar a validación directa por MongoDB
          getCurrentLogger().warn({ err: redisError }, 'Redis falló en Gateway. Degradando a MongoDB.');
          const branch = await Branch.findOne({
            _id: branchIdStr,
            owner_id: req.businessOwnerId,
          }).lean();
          if (!branch) {
            res.status(403).json({
              success: false,
              code: 'ERR_BRANCH_JURISDICTION',
              message: 'Jurisdicción inválida. La sucursal no pertenece a tu tenant.',
            });
            return;
          }
        }
      }
    }

    next();
  } catch (error) {
    getCurrentLogger().error({ err: error }, 'Error en injectBusinessContext');
    res.status(500).json({ success: false, message: 'Error cargando contexto del negocio.' });
  }
};

/**
 * Middleware para Control de Acceso (RBAC).
 * Solo se aplica a las rutas que requieran un permiso específico.
 */
export const requirePermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Dueños y Admins pasan directo
    if (req.userRole === ROLES.TENANT_OWNER || req.userRole === ROLES.ADMIN) {
      next();
      return;
    }

    // Empleados deben tener el permiso
    if (req.userRole === ROLES.EMPLOYEE) {
      if (req.userPermissions?.includes(requiredPermission)) {
        next();
      } else {
        res.status(403).json({
          success: false,
          message: `Acceso denegado. Requiere permiso: ${requiredPermission}`
        });
      }
      return;
    }

    res.status(403).json({ success: false, message: 'Rol no autorizado.' });
  };
};

/**
 * Middleware de rol estricto para acceso a endpoints administrativos
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!allowedRoles.includes(req.userRole)) {
      res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere uno de los roles: ${allowedRoles.join(', ')}.`
      });
      return;
    }
    next();
  };
};

