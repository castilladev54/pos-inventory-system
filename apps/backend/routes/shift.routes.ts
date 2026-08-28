import express from 'express';
import { openShift, closeShift, getActiveShift } from '../controllers/shift.controller.js';
import { requireBranchHeader } from '../middleware/requireBranchHeader.js';

const router = express.Router();

// Todas las rutas requieren x-branch-id para identificar la sucursal
router.post('/open', requireBranchHeader, openShift);
router.post('/close', requireBranchHeader, closeShift);
router.get('/active', requireBranchHeader, getActiveShift);

export default router;
