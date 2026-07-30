import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from '../controllers/category.controller.js';
import { validate } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema, categoryIdSchema } from '../validations/category.validation.js';

const router = express.Router();

// Crear una nueva categoría
router.post('/', validate(createCategorySchema), createCategory);

// Obtener todas las categorías
router.get('/', getCategories);

// Obtener una categoría por su ID
router.get('/:id', validate(categoryIdSchema), getCategoryById);

// Actualizar una categoría
router.put('/:id', validate(updateCategorySchema), updateCategory);

// Eliminar una categoría
router.delete('/:id', validate(categoryIdSchema), deleteCategory);

export default router;
