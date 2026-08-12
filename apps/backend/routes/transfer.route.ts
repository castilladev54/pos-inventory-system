import { Router } from 'express';
import { executeStockTransfer } from '../controllers/transfer.controller.js';
import { requireRole } from '../middleware/requirePermission.js';

const router = Router();

// ─── Transferencias de Stock ────────────────────────────────────────────────
// Solo dueños o admins pueden realizar transferencias
router.post('/', requireRole(['TENANT_OWNER', 'admin']), executeStockTransfer);

export default router;
