import express from 'express';
import { PurchaseController } from '../controllers/purchase.controller.js';
import { PurchaseService } from '../services/purchase.service.js';
import { validate } from '../middleware/validate.js';
import { createPurchaseSchema, purchaseIdSchema } from '../validations/purchase.validation.js';
import { requireBranchHeader } from '../middleware/requireBranchHeader.js';

const router = express.Router();

// Instantiate Service and Controller
const purchaseService = new PurchaseService();
const purchaseController = new PurchaseController(purchaseService);

// Rutas para Compras (Purchases)
router.post('/', validate(createPurchaseSchema), requireBranchHeader, purchaseController.createPurchase);
router.get('/', purchaseController.getPurchases);
router.get('/payments', purchaseController.getPayments);
router.get('/:id', validate(purchaseIdSchema), purchaseController.getPurchaseById);
router.put('/:id/pay', validate(purchaseIdSchema), purchaseController.payPurchase);

export default router;
