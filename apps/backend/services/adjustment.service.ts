import mongoose, { ClientSession } from 'mongoose';
import { InventoryAdjustment } from '../models/InventoryAdjustment.js';
import { Product } from '../models/Product.js';
import { BranchInventory } from '../models/BranchInventory.js';
import { Branch } from '../models/Branch.js';
import { BusinessOwnerId, ActorId, ProductId, BranchId } from '../types/brands.js';
import { bumpBranchCacheVersion } from '../lib/redis.js';

// ─── Crear Ajuste ─────────────────────────────────────────────────────────────

/**
 * Ejecuta el proceso de ajuste de inventario de forma transaccional.
 *
 * Siempre requiere branchId — no existe modo-legado.
 * El ajuste opera sobre BranchInventory y registra el evento en InventoryAdjustment (Kardex).
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
    const inventoryItem = await BranchInventory.findOne({
      product_id,
      branch_id: branchId,
      owner_id: businessOwnerId
    }).session(session);

    // Coherencia Lectura/Escritura: el pipeline de lectura (getProducts) resuelve
    // la ausencia de documento como stock = 0 mediante $ifNull. La escritura debe
    // honrar el mismo contrato en lugar de lanzar un error 404.
    const previous_stock = inventoryItem?.stock ?? 0;
    const difference = new_stock - previous_stock;

    if (difference === 0) {
      throw new Error('El nuevo stock es igual al stock actual. No hay nada que ajustar.');
    }

    // 3. Aplicar el ajuste en BranchInventory (Upsert Atómico)
    // Si el documento no existía, se crea con el stock inicial dentro de la misma
    // transacción ACID, previniendo race conditions y garantizando atomicidad.
    await BranchInventory.findOneAndUpdate(
      { product_id, branch_id: branchId, owner_id: businessOwnerId },
      { $set: { stock: new_stock } },
      { upsert: true, new: true, session, runValidators: true }
    );

    // 4. Registrar en el Kardex (InventoryAdjustment) — fuente de verdad para auditoría
    const adjustment = new InventoryAdjustment({
      product_id,
      branch_id: branchId,
      user_id: businessOwnerId,
      created_by: actorId,
      previous_stock,
      new_stock,
      difference,
      reason,
      notes: notes || ''
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
  const query = InventoryAdjustment.find({ user_id: businessOwnerId })
    .populate('product_id', 'name barcode price')
    .sort({ createdAt: -1 })
    .skip(skip);

  if (limit > 0) query.limit(limit);

  const adjustments = await query.lean();
  return adjustments.map(adj => {
    if (!adj.created_by) adj.created_by = adj.user_id;
    return adj;
  });
};

// ─── Contar Ajustes ───────────────────────────────────────────────────────────

export const fetchAdjustmentsCount = async (businessOwnerId: BusinessOwnerId) => {
  return InventoryAdjustment.countDocuments({ user_id: businessOwnerId });
};
