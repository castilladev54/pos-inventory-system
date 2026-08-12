import { Request, Response } from 'express';
import { transferStockBetweenBranches } from '../services/transfer.service.js';
import { getCurrentLogger } from '../lib/logger.js';

export const executeStockTransfer = async (req: Request, res: Response) => {
  try {
    const { sourceBranchId, destinationBranchId, items, notes } = req.body;
    
    // El middleware inyecta estos valores
    const businessOwnerId = req.businessOwnerId;
    const actorId = req.actorId;

    if (!sourceBranchId || !destinationBranchId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Faltan datos obligatorios para la transferencia' });
    }

    const result = await transferStockBetweenBranches({
      sourceBranchId,
      destinationBranchId,
      businessOwnerId: businessOwnerId as string,
      actorId: actorId as string,
      items,
      notes
    });

    return res.status(200).json(result);
  } catch (error: any) {
    getCurrentLogger().error({ err: error }, 'Error en executeStockTransfer');
    return res.status(400).json({ success: false, message: error.message || 'Error al ejecutar la transferencia' });
  }
};
