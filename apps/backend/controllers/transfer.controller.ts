import { Request, Response } from 'express';
import { transferStockBetweenBranches } from '../services/transfer.service.js';

export const executeStockTransfer = async (req: Request, res: Response) => {
  const {
    sourceBranchId,
    destinationBranchId,
    items,
    notes
  } = req.body;

  const businessOwnerId = req.businessOwnerId;
  const actorId = req.actorId;

  const result = await transferStockBetweenBranches({
    sourceBranchId,
    destinationBranchId,
    businessOwnerId: businessOwnerId as string,
    actorId: actorId as string,
    items,
    notes
  });

  return res.status(200).json(result);
};
