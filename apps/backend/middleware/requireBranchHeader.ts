import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/error.js';

export const requireBranchHeader = (req: Request, res: Response, next: NextFunction) => {
  if (!req.branchId) {
    return next(new AppError(400, 'x-branch-id header is missing'));
  }
  next();
};
