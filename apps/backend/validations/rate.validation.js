import { z } from 'zod';
import { rateBodySchema } from '@inventory/shared/validations';

export const rateSchema = z.object({
  body: rateBodySchema
});
