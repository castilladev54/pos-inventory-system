import express from 'express';
import {
    createSale,
    getSales,
    getSaleById,
    cancelSale,
    updateSale
} from '../controllers/sale.controller.js';
import { validate } from '../middleware/validate.js';
import { createSaleSchema, saleIdSchema, updateSaleSchema } from '../validations/sale.validation.js';

const router = express.Router();

// Rutas para Ventas (Sales)
router.post('/', validate(createSaleSchema), createSale);
router.get('/', getSales);
router.get('/:id', validate(saleIdSchema), getSaleById);
router.patch('/:id', validate(updateSaleSchema), updateSale);
router.put('/:id/cancel', validate(saleIdSchema), cancelSale);

export default router;
