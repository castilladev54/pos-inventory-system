import mongoose, { ClientSession } from 'mongoose';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { StockMovement, StockMovementType } from '../models/StockMovement.js';
import { Branch } from '../models/Branch.js';
import { BusinessOwnerId, ActorId, ProductId, BranchId } from '../types/brands.js';
import { bumpBranchCacheVersion } from '../lib/redis.js';

// ─── Crear Ajuste ─────────────────────────────────────────────────────────────

/**
 * Ejecuta el proceso de ajuste de inventario de forma transaccional.
 *
 * Siempre requiere branchId — no existe modo-legado.
 * El ajuste opera sobre Inventory y registra el evento en StockMovement (Kardex).
 *
 * @param actorId         - ID del operador que ejecuta el ajuste
 * @param businessOwnerId - ID del dueño del negocio (tenant)
 * @param branchId        - ID de la sucursal a ajustar (OBLIGATORIO)
 * @param product_id      - ID del producto
 * @param new_stock       - Nuevo valor absoluto de stock
 * @param reason          - Motivo del ajuste
 * @param notes           - Notas adicionales
 * @param extSession      - Sesión externa opcional (para composición transaccional)
 */
export const createAdjustmentProcess = async (
  actorId: ActorId,
  businessOwnerId: BusinessOwnerId,
  branchId: BranchId,
  product_id: ProductId,
  new_stock: number,
  reason: string,
  notes: string,
  extSession: ClientSession | null = null
) => {
  const ownSession = !extSession;
  const session = extSession ?? await mongoose.startSession();

  if (ownSession) session.startTransaction();

  try {
    // 0. Verificar que la sucursal existe y está activa
    const branch = await Branch.findOne({
      _id: branchId,
      owner_id: businessOwnerId,
      is_active: true
    }).session(session);

    if (!branch) {
      throw new Error('La sucursal a ajustar no existe o se encuentra inactiva.');
    }

    // 1. Verificar que el producto pertenece al tenant (filtro de seguridad)
    const product = await Product.findOne({ _id: product_id, user: businessOwnerId }).session(session);
    if (!product) {
      throw new Error('Producto no encontrado o no te pertenece');
    }

    // 2. Leer el stock actual de la sucursal (puede no existir → Lazy Creation)
    const inventoryItem = await Inventory.findOne({
      product_id,
      branch_id: branchId,
      owner_id: businessOwnerId
    }).session(session);

    const previous_stock = inventoryItem ? Number(inventoryItem.quantity.toString()) : 0;
    const difference = new_stock - previous_stock;

    if (difference === 0) {
      throw new Error('El nuevo stock es igual al stock actual. No hay nada que ajustar.');
    }

    // 3. Aplicar el ajuste en Inventory (Upsert Atómico)
    const updatedInventory = await Inventory.findOneAndUpdate(
      { product_id, branch_id: branchId, owner_id: businessOwnerId },
      { $set: { quantity: new_stock } },
      { upsert: true, new: true, session, runValidators: true }
    );

    // 4. Registrar en el Kardex (StockMovement)
    const adjustment = new StockMovement({
      inventory_id: updatedInventory._id,
      product_id,
      branch_id: branchId,
      owner_id: businessOwnerId,
      type: StockMovementType.MANUAL_ADJUSTMENT,
      quantity_change: difference,
      previous_quantity: previous_stock,
      new_quantity: new_stock,
      created_by: actorId,
      reason: reason + (notes ? ` - ${notes}` : '')
    });

    await adjustment.save({ session });

    if (ownSession) {
      await session.commitTransaction();
      session.endSession();
      await bumpBranchCacheVersion('products', String(businessOwnerId), String(branchId));
    }

    return adjustment;
  } catch (error) {
    if (ownSession) {
      await session.abortTransaction();
      session.endSession();
    }
    throw error;
  }
};

// ─── Listar Ajustes ───────────────────────────────────────────────────────────

export const fetchAdjustments = async (
  businessOwnerId: BusinessOwnerId,
  skip = 0,
  limit = 0
) => {
  const query = StockMovement.find({ 
    owner_id: businessOwnerId,
    type: StockMovementType.MANUAL_ADJUSTMENT 
  })
    .populate('product_id', 'name barcode price')
    .sort({ createdAt: -1 })
    .skip(skip);

  if (limit > 0) query.limit(limit);

  const adjustments = await query.lean();
  return adjustments.map(adj => {
    // Para retrocompatibilidad si la UI espera user_id o difference
    return {
      ...adj,
      user_id: adj.owner_id,
      difference: Number(adj.quantity_change.toString()),
      previous_stock: Number(adj.previous_quantity.toString()),
      new_stock: Number(adj.new_quantity.toString())
    };
  });
};

// ─── Contar Ajustes ───────────────────────────────────────────────────────────

export const fetchAdjustmentsCount = async (businessOwnerId: BusinessOwnerId) => {
  return StockMovement.countDocuments({ 
    owner_id: businessOwnerId,
    type: StockMovementType.MANUAL_ADJUSTMENT
  });
};
