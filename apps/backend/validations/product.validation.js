import { z } from 'zod';
import { 
  createProductBodySchema, 
  updateProductBodySchema, 
  barcodeParamSchema as sharedBarcodeParamSchema, 
  idParamSchema 
} from '@inventory/shared/validations';

export const createProductSchema = z.object({
  body: createProductBodySchema
});

export const updateProductSchema = z.object({
  params: idParamSchema,
  body: updateProductBodySchema
});

export const productIdSchema = z.object({
  params: idParamSchema
});

export const barcodeParamSchema = z.object({
  params: sharedBarcodeParamSchema
});
