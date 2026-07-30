import { z } from 'zod';
import { createAdjustmentBodySchema } from '@inventory/shared/validations';

export const createAdjustmentSchema = z.object({
  body: createAdjustmentBodySchema
});
