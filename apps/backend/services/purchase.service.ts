import mongoose from 'mongoose';
import { Purchase } from '../models/Purchase.js';
import { PurchaseDetail } from '../models/PurchaseDetail.js';
import { Product } from '../models/Product.js';
import { BranchInventory } from '../models/BranchInventory.js';
import { SupplierPayment } from '../models/SupplierPayment.js';
import { Branch } from '../models/Branch.js';
import { BusinessOwnerId, ProductId, BranchId } from '../types/brands.js';
import { bumpBranchCacheVersion } from '../lib/redis.js';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface PurchaseItemInput {
  product_id: ProductId;
  quantity: number;
  unit_cost: number;
}

export interface PurchaseFilters {
  status?: 'PENDING' | 'PARTIAL' | 'PAID';
  due_date?: Record<string, Date>;
  [key: string]: unknown;
}

// ─── Crear Compra ─────────────────────────────────────────────────────────────

/**
 * Servicio transaccional para registrar compras.
 *
 * Garantías ACID:
 *   - Verifica que la sucursal existe y está activa (is_active: true)
 *   - Verifica que todos los productos pertenezcan al tenant antes de modificar nada
 *   - Incrementa BranchInventory.stock de la sucursal destino
 *   - El hook pre-save de PurchaseDetail recalcula av_inventory_cost dentro de la misma sesión
 *   - Si cualquier paso falla, MongoDB revierte todos los cambios
 *
 * @param businessOwnerId  ID del dueño del negocio (tenant)
 * @param branchId         ID de la sucursal que recibe la mercancía (OBLIGATORIO)
 * @param supplier         Nombre del proveedor
 * @param items            Líneas de la compra
 * @param dueDate          Fecha límite de pago (default: 30 días)
 * @param exchange_rate    Tasa de cambio opcional
 */
export const createPurchaseProcess = async (
  businessOwnerId: BusinessOwnerId,
  branchId: BranchId,
  supplier: string,
  items: PurchaseItemInput[],
  dueDate: Date | null = null,
  exchange_rate: number | null = null
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 0. Validar que la sucursal existe y está activa
    const branch = await Branch.findOne({
      _id: branchId,
      owner_id: businessOwnerId,
      is_active: true
    }).session(session);

    if (!branch) {
      throw new Error('La sucursal destino no existe o se encuentra inactiva.');
    }

    let total_cost = 0;

    // Validación en bloque (evita N+1): verifica que todos los productos
    // existan y pertenezcan al tenant antes de crear nada
    const productIds = items.map(i => i.product_id);
    const products = await Product.find({ _id: { $in: productIds }, user: businessOwnerId }).session(session);
    const productsMap = new Map(products.map(p => [p._id.toString(), p]));

    for (const item of items) {
      if (!productsMap.has(item.product_id.toString())) {
        throw new Error(`Producto con ID ${item.product_id} no encontrado o no te pertenece.`);
      }
      total_cost += item.quantity * item.unit_cost;
    }

    // Si no se envía fecha de vencimiento, por defecto 30 días
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);

    const purchase = new Purchase({
      admin_id: businessOwnerId,
      branch_id: branchId,
      supplier,
      total_cost,
      due_date: dueDate ?? defaultDueDate,
      exchange_rate
    });
    await purchase.save({ session });

    // Incrementar BranchInventory.stock e crear PurchaseDetail para cada ítem
    for (const item of items) {
      // 1. Incrementar stock en la sucursal destino (operación atómica dentro de la transacción)
      // owner_id en el filtro garantiza aislamiento multi-tenant y que el documento
      // creado por upsert pertenezca al tenant correcto.
      await BranchInventory.findOneAndUpdate(
        { branch_id: branchId, product_id: item.product_id, owner_id: businessOwnerId },
        { $inc: { stock: item.quantity } },
        { upsert: true, session }
      );

      // 2. Crear PurchaseDetail — su hook pre-save recalcula av_inventory_cost
      //    usando la misma sesión transaccional (snapshot consistente)
      const detail = new PurchaseDetail({
        purchase_id: purchase._id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost
      });
      await detail.save({ session });
    }

    await session.commitTransaction();
    session.endSession();
    
    await bumpBranchCacheVersion('products', String(businessOwnerId), String(branchId));
    
    return purchase;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// ─── Listar Compras ───────────────────────────────────────────────────────────

export const fetchPurchases = async (
  businessOwnerId: BusinessOwnerId,
  filters: PurchaseFilters = {},
  skip = 0,
  limit = 0
) => {
  const query = Purchase.find({ admin_id: businessOwnerId, ...filters } as Record<string, unknown>)
    .populate('admin_id', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip);

  if (limit > 0) query.limit(limit);

  return query.lean();
};

export const fetchPurchasesCount = async (
  businessOwnerId: BusinessOwnerId,
  filters: PurchaseFilters = {}
) => {
  return Purchase.countDocuments({ admin_id: businessOwnerId, ...filters } as Record<string, unknown>);
};

// ─── Detalle de una Compra ────────────────────────────────────────────────────

export const fetchPurchaseById = async (
  id: string,
  businessOwnerId: BusinessOwnerId
) => {
  const purchase = await Purchase.findOne({ _id: id, admin_id: businessOwnerId })
    .populate('admin_id', 'name email')
    .lean();

  if (!purchase) return null;

  const details = await PurchaseDetail.find({ purchase_id: id })
    .populate('product_id', 'name')
    .lean();

  return { purchase, details };
};

// ─── Registrar Abono ──────────────────────────────────────────────────────────

export const registerPayment = async (
  purchaseId: string,
  businessOwnerId: BusinessOwnerId,
  amount: number
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findOne({ _id: purchaseId, admin_id: businessOwnerId }).session(session);
    if (!purchase) throw new Error('Compra no encontrada.');
    if (purchase.status === 'PAID') throw new Error('La compra ya se encuentra pagada completamente.');

    purchase.paid_amount = (purchase.paid_amount || 0) + amount;

    let actualAmountPaid = amount;
    if (purchase.paid_amount >= purchase.total_cost) {
      purchase.status = 'PAID';
      actualAmountPaid = amount - (purchase.paid_amount - purchase.total_cost);
      purchase.paid_amount = purchase.total_cost;
      purchase.payment_date = new Date();
    } else {
      purchase.status = 'PARTIAL';
    }

    await purchase.save({ session });

    if (actualAmountPaid > 0) {
      const payment = new SupplierPayment({
        purchase_id: purchase._id,
        admin_id: businessOwnerId,
        amount: actualAmountPaid
      });
      await payment.save({ session });
    }

    await session.commitTransaction();
    session.endSession();
    return purchase;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// ─── Listar Pagos ─────────────────────────────────────────────────────────────

export const fetchPayments = async (businessOwnerId: BusinessOwnerId) => {
  return SupplierPayment.find({ admin_id: businessOwnerId })
    .populate('purchase_id', 'supplier')
    .sort({ createdAt: -1 })
    .lean();
};
