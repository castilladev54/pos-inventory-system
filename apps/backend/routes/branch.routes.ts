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
import { requirePermission } from '../middleware/requirePermission.js';

const router = Router();

// ─── CRUD de Sucursales ────────────────────────────────────────────────────────
// Solo dueños/admins pueden crear, editar o eliminar sucursales.
// Los empleados con permiso 'view_branches' pueden consultarlas.

router.get('/', getBranches);
router.get('/:id', requirePermission('view_branches'), getBranchById);
router.post('/', createBranch);           // Solo TENANT_OWNER/admin (RBAC)
router.patch('/:id', updateBranch);       // Solo TENANT_OWNER/admin (RBAC)
router.delete('/:id', deleteBranch);      // Soft-delete — Solo TENANT_OWNER/admin (RBAC)

// ─── Inventario por Sucursal ────────────────────────────────────────────────
router.get('/:id/inventory', requirePermission('view_branches'), getBranchInventory);
router.patch('/:id/inventory', upsertBranchInventory); // Solo TENANT_OWNER/admin (RBAC)

export default router;
