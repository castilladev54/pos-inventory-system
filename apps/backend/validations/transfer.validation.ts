import { z } from 'zod';
import { createStockTransferBodySchema } from '@inventory/shared/validations';

export const createStockTransferSchema = z.object({
  body: createStockTransferBodySchema
});
