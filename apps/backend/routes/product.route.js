import express from 'express';
import {
    createProduct,
    getProducts,
    getProductById,
    getProductByBarcode,
    updateProduct,
    deleteProduct
} from '../controllers/product.controller.js';
import { validate } from '../middleware/validate.js';
import { createProductSchema, updateProductSchema, productIdSchema, barcodeParamSchema } from '../validations/product.validation.js';

const router = express.Router();

// Rutas para Productos
router.post('/', validate(createProductSchema), createProduct);
router.get('/', getProducts);
router.get('/barcode/:code', validate(barcodeParamSchema), getProductByBarcode);
router.get('/:id', validate(productIdSchema), getProductById);
router.put('/:id', validate(updateProductSchema), updateProduct);
router.delete('/:id', validate(productIdSchema), deleteProduct);

export default router;
