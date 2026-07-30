import { z } from 'zod';
import { 
  createPurchaseBodySchema, 
  idParamSchema 
} from '@inventory/shared/validations';

export const createPurchaseSchema = z.object({
  body: createPurchaseBodySchema
});

export const purchaseIdSchema = z.object({
  params: idParamSchema
});
