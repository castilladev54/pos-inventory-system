import mongoose from 'mongoose';
import Big from 'big.js';
import { Branch } from '../models/Branch.js';
import { Inventory } from '../models/Inventory.js';
import { StockMovement, StockMovementType } from '../models/StockMovement.js';

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

      if (Big(quantity).lte(0)) {
        throw new Error(`La cantidad a transferir debe ser mayor a 0.`);
      }

      // Restar stock de la sucursal de origen
      const sourceInventory = await Inventory.findOne({
        branch_id: sourceBranchId,
        product_id: product_id
      }).session(session);

      if (!sourceInventory || Big(sourceInventory.quantity as any).lt(Big(quantity))) {
        throw new Error(`Stock insuficiente en sucursal de origen para realizar la transferencia.`);
      }

      const previousSourceQuantity = sourceInventory.quantity.toString();
      sourceInventory.quantity = Big(sourceInventory.quantity as any).minus(Big(quantity)).toString() as any;
      await sourceInventory.save({ session });

      // Registrar Kardex de salida
      await StockMovement.create([{
        inventory_id: sourceInventory._id,
        product_id: product_id,
        branch_id: sourceBranchId,
        owner_id: businessOwnerId,
        type: StockMovementType.TRANSFER_OUT,
        quantity_change: Big(quantity).times(-1).toString(),
        previous_quantity: previousSourceQuantity,
        new_quantity: sourceInventory.quantity.toString(),
        created_by: actorId,
        reason: notes || `Transferencia hacia sucursal ${destBranch.name}`
      }], { session });

      // Sumar stock en la sucursal de destino
      let destInventory = await Inventory.findOne({
        branch_id: destinationBranchId,
        product_id: product_id
      }).session(session);

      let previousDestQuantity = '0';
      if (!destInventory) {
        // Crear el inventario si no existe en la sucursal de destino
        const newDestInventoryArray = await Inventory.create([{
          owner_id: businessOwnerId,
          branch_id: destinationBranchId,
          product_id: product_id,
          quantity: quantity,
          min_stock_alert: '0'
        }], { session });
        destInventory = newDestInventoryArray[0] ?? null;
      } else {
        previousDestQuantity = destInventory.quantity.toString();
        destInventory.quantity = Big(destInventory.quantity as any).plus(Big(quantity)).toString() as any;
        await destInventory.save({ session });
      }

      if (!destInventory) {
        throw new Error('Error crítico: no se pudo crear ni encontrar el inventario de destino.');
      }

      // Registrar Kardex de entrada
      await StockMovement.create([{
        inventory_id: destInventory._id,
        product_id: product_id,
        branch_id: destinationBranchId,
        owner_id: businessOwnerId,
        type: StockMovementType.TRANSFER_IN,
        quantity_change: quantity,
        previous_quantity: previousDestQuantity,
        new_quantity: destInventory.quantity.toString(),
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
    session.endSession();
  }
};
