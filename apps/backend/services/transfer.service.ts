import mongoose from 'mongoose';
import { Branch } from '../models/Branch.js';
import { BranchInventory } from '../models/BranchInventory.js';
import { InventoryAdjustment } from '../models/InventoryAdjustment.js';

interface TransferItem {
  product_id: string;
  quantity: number;
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
      throw new Error(`Sucursal de origen no encontrada o no pertenece a su tenant.`);
    }

    const destBranch = await Branch.findOne({ _id: destinationBranchId, owner_id: businessOwnerId }).session(session).lean();
    if (!destBranch) {
      throw new Error(`Sucursal de destino no encontrada o no pertenece a su tenant.`);
    }

    if (sourceBranchId === destinationBranchId) {
      throw new Error(`La sucursal de origen y destino no pueden ser la misma.`);
    }

    // 2. Procesar cada item atómicamente
    for (const item of items) {
      const { product_id, quantity } = item;

      if (quantity <= 0) {
        throw new Error(`La cantidad a transferir debe ser mayor a 0.`);
      }

      // Restar stock de la sucursal de origen
      const sourceInventory = await BranchInventory.findOne({
        branch_id: sourceBranchId,
        product_id: product_id
      }).session(session);

      if (!sourceInventory || sourceInventory.stock < quantity) {
        throw new Error(`Stock insuficiente en sucursal de origen para realizar la transferencia.`);
      }

      const previousSourceStock = sourceInventory.stock;
      sourceInventory.stock -= quantity;
      await sourceInventory.save({ session });

      // Registrar Kardex de salida
      await InventoryAdjustment.create([{
        product_id: product_id,
        branch_id: sourceBranchId,
        user_id: actorId,
        previous_stock: previousSourceStock,
        new_stock: sourceInventory.stock,
        difference: -quantity,
        reason: 'transfer_out',
        notes: notes || `Transferencia hacia sucursal ${destBranch.name}`
      }], { session });

      // Sumar stock en la sucursal de destino
      let destInventory = await BranchInventory.findOne({
        branch_id: destinationBranchId,
        product_id: product_id
      }).session(session);

      let previousDestStock = 0;
      if (!destInventory) {
        // Crear el inventario si no existe en la sucursal de destino
        const newDestInventoryArray = await BranchInventory.create([{
          owner_id: businessOwnerId,
          branch_id: destinationBranchId,
          product_id: product_id,
          stock: quantity,
          min_stock: 0
        }], { session });
        destInventory = newDestInventoryArray[0];
      } else {
        previousDestStock = destInventory.stock;
        destInventory.stock += quantity;
        await destInventory.save({ session });
      }

      // Registrar Kardex de entrada
      await InventoryAdjustment.create([{
        product_id: product_id,
        branch_id: destinationBranchId,
        user_id: actorId,
        previous_stock: previousDestStock,
        new_stock: destInventory.stock,
        difference: quantity,
        reason: 'transfer_in',
        notes: notes || `Transferencia desde sucursal ${sourceBranch.name}`
      }], { session });
    }

    await session.commitTransaction();
    return { success: true, message: 'Transferencia completada exitosamente' };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
