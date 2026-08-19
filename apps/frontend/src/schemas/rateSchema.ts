import { z } from 'zod';

export const RateSchema = z.object({
  rate: z.string(),
  updatedAt: z.string().datetime().optional(),
  is_manual_override: z.boolean().optional(),
});
