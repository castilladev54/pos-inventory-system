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
import { requireBranchHeader } from '../middleware/requireBranchHeader.js';

const router = express.Router();

// Rutas para Ventas (Sales)
router.post('/', requireBranchHeader, validate(createSaleSchema), createSale);
router.get('/', getSales);
router.get('/:id', validate(saleIdSchema), getSaleById);
router.patch('/:id', requireBranchHeader, validate(updateSaleSchema), updateSale);
router.put('/:id/cancel', requireBranchHeader, validate(saleIdSchema), cancelSale);

export default router;
