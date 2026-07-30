import express from 'express';
import { validate } from '../middleware/validate.js';
import { createAdjustmentSchema } from '../validations/adjustment.validation.js';
import { createAdjustment, getAdjustments } from '../controllers/adjustment.controller.js';
import { cacheMiddleware } from '../middleware/cache.middleware.js';

const router = express.Router();

// 2. Definición de rutas
router.get('/', cacheMiddleware('adjustments', 'adjustments'), getAdjustments);
// Usamos el middleware de Zod para asegurar que envían {product_id, new_stock, reason} correcto
router.post('/', validate(createAdjustmentSchema), createAdjustment);

export default router;
