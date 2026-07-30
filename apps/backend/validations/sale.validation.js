import { z } from 'zod';
import { 
  createSaleBodySchema, 
  updateSaleBodySchema, 
  idParamSchema 
} from '@inventory/shared/validations';

export const createSaleSchema = z.object({
  body: createSaleBodySchema
});

export const saleIdSchema = z.object({
  params: idParamSchema
});

export const updateSaleSchema = z.object({
  params: idParamSchema,
  body: updateSaleBodySchema
});
