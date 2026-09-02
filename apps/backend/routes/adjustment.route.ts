import express from 'express';
import { createAdjustmentController, getAdjustments } from '../controllers/adjustment.controller.js';
import { cacheMiddleware } from '../middleware/cache.middleware.js';
import { requireBranchHeader } from '../middleware/requireBranchHeader.js';

const router = express.Router();

// 2. Definición de rutas
router.get('/', cacheMiddleware('adjustments', 'adjustments'), getAdjustments);

// Inyección de Middleware: Proteger el endpoint con requireBranchHeader
router.post('/', requireBranchHeader, createAdjustmentController);

export default router;
