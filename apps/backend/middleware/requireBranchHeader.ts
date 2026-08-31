import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/error.js';
import { purchaseHeaderSchema } from '@inventory/shared/validations';

export const requireBranchHeader = (req: Request, _res: Response, next: NextFunction): void => {
  const headerValue = req.headers['x-branch-id'];
  if (!headerValue) {
    // No branch header provided; allow request to proceed (global request)
    return next();
  }
  const result = purchaseHeaderSchema.safeParse({
    'x-branch-id': headerValue
  });
  if (!result.success) {
    return next(new AppError(400, 'Cabecera x-branch-id es requerida y debe ser un ID válido'));
  }
  req.branchId = result.data['x-branch-id'];
  next();
};
