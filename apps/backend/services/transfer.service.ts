import mongoose from 'mongoose';
import Big from 'big.js';
import { Branch } from '../models/Branch.js';
import { Inventory } from '../models/Inventory.js';
import { StockMovement, StockMovementType } from '../models/StockMovement.js';
import { AppError } from '../lib/error.js';

interface TransferItem {
  product_id: string;
  quantity: string;
}

interface TransferParams {
  sourceBranchId: string;
  destinationBranchId: string;
  businessOwnerId: string;
  actorId: string;
  items: TransferItem[];
  notes?: string;
}

export const transferStockBetweenBranches = async ({
  sourceBranchId,
  destinationBranchId,
  businessOwnerId,
  actorId,
  items,
  notes
}: TransferParams) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Validar que las sucursales existan y pertenezcan al mismo tenant
    const sourceBranch = await Branch.findOne({ _id: sourceBranchId, owner_id: businessOwnerId }).session(session).lean();
    if (!sourceBranch) {
      throw new AppError(404, `Sucursal de origen no encontrada o no pertenece a su tenant.`);
    }

    const destBranch = await Branch.findOne({ _id: destinationBranchId, owner_id: businessOwnerId }).session(session).lean();
    if (!destBranch) {
      throw new AppError(404, `Sucursal de destino no encontrada o no pertenece a su tenant.`);
    }

    if (sourceBranchId === destinationBranchId) {
      throw new AppError(400, `La sucursal de origen y destino no pueden ser la misma.`);
    }

    // 2. Procesar cada item atómicamente
    for (const item of items) {
      const { product_id, quantity } = item;

      if (Big(quantity).lte(0)) {
        throw new AppError(400, `La cantidad a transferir debe ser mayor a 0.`);
      }

      const decimalQuantity = mongoose.Types.Decimal128.fromString(quantity);
      const decimalNegativeQuantity = mongoose.Types.Decimal128.fromString("-" + quantity);

      // Restar stock de la sucursal de origen atómicamente
      const sourceInventory = await Inventory.findOneAndUpdate(
        {
          branch_id: sourceBranchId,
          product_id: product_id,
          quantity: { $gte: decimalQuantity }
        },
        {
          $inc: { quantity: decimalNegativeQuantity }
        },
        {
          new: false,
          session
        }
      );

      if (!sourceInventory) {
        throw new AppError(400, `Stock insuficiente o producto no encontrado en sucursal de origen para realizar la transferencia.`);
      }

      const previousSourceQuantity = sourceInventory.quantity.toString();
      const newSourceQuantity = Big(previousSourceQuantity).minus(quantity).toString();

      // Registrar Kardex de salida
      await StockMovement.create([{
        inventory_id: sourceInventory._id,
        product_id: product_id,
        branch_id: sourceBranchId,
        owner_id: businessOwnerId,
        type: StockMovementType.TRANSFER_OUT,
        quantity_change: Big(quantity).times(-1).toString(),
        previous_quantity: previousSourceQuantity,
        new_quantity: newSourceQuantity,
        created_by: actorId,
        reason: notes || `Transferencia hacia sucursal ${destBranch.name}`
      }], { session });

      // Sumar stock en la sucursal de destino atómicamente
      const destResultRaw = await Inventory.findOneAndUpdate(
        {
          branch_id: destinationBranchId,
          product_id: product_id
        },
        {
          $inc: { quantity: decimalQuantity },
          $setOnInsert: {
            owner_id: businessOwnerId,
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

      // Bypass estricto de TS para el objeto nativo ModifyResult de MongoDB
      const destResult = destResultRaw as unknown as {
        value: { _id: mongoose.Types.ObjectId; quantity: mongoose.Types.Decimal128 } | null;
        lastErrorObject?: { upserted?: mongoose.Types.ObjectId };
      };

      if (!destResult) {
        throw new AppError(500, 'Fallo crítico en la comunicación con la base de datos durante el upsert.');
      }

      let destInventoryId;
      let previousDestQuantity = "0";

      if (destResult.value) {
        destInventoryId = destResult.value._id;
        previousDestQuantity = destResult.value.quantity.toString();
      } else {
        destInventoryId = destResult.lastErrorObject?.upserted;
        if (!destInventoryId) {
          throw new AppError(500, 'Fallo crítico recuperando ID del nuevo inventario destino.');
        }
      }

      const newDestQuantity = Big(previousDestQuantity).plus(quantity).toString();

      // Registrar Kardex de entrada
      await StockMovement.create([{
        inventory_id: destInventoryId,
        product_id: product_id,
        branch_id: destinationBranchId,
        owner_id: businessOwnerId,
        type: StockMovementType.TRANSFER_IN,
        quantity_change: quantity,
        previous_quantity: previousDestQuantity,
        new_quantity: newDestQuantity,
        created_by: actorId,
        reason: notes || `Transferencia desde sucursal ${sourceBranch.name}`
      }], { session });
    }

    await session.commitTransaction();
    return { success: true, message: 'Transferencia completada exitosamente' };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};
