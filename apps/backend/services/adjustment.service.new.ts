import mongoose from 'mongoose';
import Big from 'big.js';
import { Inventory } from '../models/Inventory.js';
import { StockMovement, StockMovementType } from '../models/StockMovement.js';
import { AppError } from '../lib/error.js';
import { CreateAdjustmentDTO } from '../validations/adjustment.validation.js';

interface AdjustmentParams extends CreateAdjustmentDTO {
  actorId: string;
  ownerId: string;
  targetBranchId: string;
}

export const executeAdjustment = async ({
  product_id,
  targetBranchId,
  quantity,
  reason,
  notes,
  actorId,
  ownerId
}: AdjustmentParams) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const stringQty = quantity.toString();
    const decimalQuantity = mongoose.Types.Decimal128.fromString(stringQty);

    const inventoryResultRaw = await Inventory.findOneAndUpdate(
      {
        branch_id: targetBranchId,
        product_id: product_id
      },
      {
        $inc: { quantity: decimalQuantity },
        $setOnInsert: {
          owner_id: ownerId,
          min_stock_alert: '0'
        }
      },
      {
        upsert: true,
        new: false,
        session,
        rawResult: true
      }
    );

    const inventoryResult = inventoryResultRaw as unknown as {
      value: { _id: mongoose.Types.ObjectId; quantity: mongoose.Types.Decimal128 } | null;
      lastErrorObject?: { upserted?: mongoose.Types.ObjectId };
    };

    let inventoryId: mongoose.Types.ObjectId | undefined;
    let previousQuantity = '0';

    if (inventoryResult.value) {
      inventoryId = inventoryResult.value._id;
      previousQuantity = inventoryResult.value.quantity.toString();
    } else {
      inventoryId = inventoryResult.lastErrorObject?.upserted;
      if (!inventoryId) {
        throw new AppError(500, 'Error crítico al recuperar ID de inventario en ajuste.');
      }
    }

    const newQuantity = Big(previousQuantity).plus(stringQty).toString();

    await StockMovement.create(
      [
        {
          inventory_id: inventoryId,
          product_id: product_id,
          branch_id: targetBranchId,
          owner_id: ownerId,
          type: StockMovementType.ADJUSTMENT,
          quantity_change: stringQty,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          created_by: actorId,
          reason: `AJUSTE [${reason}]: ${notes || 'Sin especificación'}`
        }
      ],
      { session }
    );

    await session.commitTransaction();
    return {
      success: true,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};
