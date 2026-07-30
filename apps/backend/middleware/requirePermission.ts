import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { BusinessOwnerId, ActorId, BranchId } from '../types/brands.js';
import { getCurrentLogger } from '../lib/logger.js';

/**
 * Middleware Global para rutas protegidas.
 * Obtiene el contexto del negocio e inyecta req.businessOwnerId y req.actorId.
 * También inyecta req.branchId si viene en el header 'x-branch-id'.
 * Garantía de seguridad: todas las queries downstream usan businessOwnerId como tenant-filter.
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
      req.userRole = meta.role;
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
      req.userRole = user.role as string;
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

    // Inyectar branchId si se provee en los headers (ej. x-branch-id)
    const headerBranchId = req.headers['x-branch-id'];
    if (headerBranchId && typeof headerBranchId === 'string' && Types.ObjectId.isValid(headerBranchId)) {
      req.branchId = new Types.ObjectId(headerBranchId) as unknown as BranchId;
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
    if (req.userRole === 'customer' || req.userRole === 'admin') {
      next();
      return;
    }

    // Empleados deben tener el permiso
    if (req.userRole === 'employee') {
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
