import { z } from 'zod';

export const adjustmentReasonEnum = z.enum([
  'INITIAL_INVENTORY',
  'CORRECTION',
  'LOSS',
  'DAMAGE',
  'EXPIRED'
]);

export const createAdjustmentSchema = z.object({
  product_id: z.string().min(1, 'ID de producto es requerido'),
  branch_id: z.string().min(1, 'ID de sucursal inválido').optional(),
  quantity: z.number().refine((val) => val !== 0, {
    message: 'La cantidad a ajustar no puede ser cero'
  }),
  reason: adjustmentReasonEnum,
  notes: z.string().max(255).optional()
});

export type CreateAdjustmentDTO = z.infer<typeof createAdjustmentSchema>;
