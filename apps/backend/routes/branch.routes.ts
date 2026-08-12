import { Router } from 'express';
import {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchInventory,
  upsertBranchInventory
} from '../controllers/branch.controller.js';
import { requirePermission, requireRole } from '../middleware/requirePermission.js';

const router = Router();

// ─── CRUD de Sucursales ────────────────────────────────────────────────────────
// Solo dueños/admins pueden crear, editar o eliminar sucursales.
// Los empleados con permiso 'view_branches' pueden consultarlas.

router.get('/', getBranches);
router.get('/:id', requirePermission('view_branches'), getBranchById);
router.post('/', requireRole(['TENANT_OWNER', 'admin']), createBranch);           // Solo TENANT_OWNER/admin (RBAC)
router.patch('/:id', requireRole(['TENANT_OWNER', 'admin']), updateBranch);       // Solo TENANT_OWNER/admin (RBAC)
router.delete('/:id', requireRole(['TENANT_OWNER', 'admin']), deleteBranch);      // Soft-delete — Solo TENANT_OWNER/admin (RBAC)

// ─── Inventario por Sucursal ────────────────────────────────────────────────
router.get('/:id/inventory', requirePermission('view_branches'), getBranchInventory);
router.patch('/:id/inventory', requireRole(['TENANT_OWNER', 'admin']), upsertBranchInventory); // Solo TENANT_OWNER/admin (RBAC)

export default router;
