import { z } from 'zod';
import { 
  createCategoryBodySchema, 
  updateCategoryBodySchema, 
  idParamSchema 
} from '@inventory/shared/validations';

export const createCategorySchema = z.object({
  body: createCategoryBodySchema
});

export const updateCategorySchema = z.object({
  params: idParamSchema,
  body: updateCategoryBodySchema
});

export const categoryIdSchema = z.object({
  params: idParamSchema
});
