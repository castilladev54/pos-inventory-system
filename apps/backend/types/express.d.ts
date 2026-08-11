import { BusinessOwnerId, ActorId, BranchId } from './brands';
import { Role } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      // ─── Inyectado por verifyToken ────────────────────────────────────────
      userId?: string;                   // ID raw del JWT (string)

      // Metadata stateless extraída del JWT por verifyToken.
      // null = token pre-migración sin metadata → injectBusinessContext hará fallback a DB.
      userMetadata?: {
        role: string;
        permissions: string[];
        ownerId: string | null;
        assignedBranches: string[];
      } | null;

      // ─── Inyectado por injectBusinessContext ──────────────────────────────
      businessOwnerId: BusinessOwnerId;  // ID del dueño del negocio (tenant)
      actorId: ActorId;                  // ID del operador (empleado o dueño)
      branchId?: BranchId;              // ID de la sucursal activa (opcional, del header — NO usar para authz)

      // Fuente de verdad de acceso: cargado desde DB en injectBusinessContext.
      // NUNCA proviene del cliente. Usar ESTE array para autorizar acceso a sucursales.
      assignedBranches: string[];        // IDs de sucursales autorizadas (solo para empleados)

      // Campos auxiliares de contexto
      realUserId?: string;               // ID real del usuario autenticado
      userRole?: Role;                   // Tipado estricto derivado de ROLES
      userPermissions?: string[];        // Permisos granulares del actor
    }
  }
}
