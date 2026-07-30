import mongoose from 'mongoose';
import { invalidateCache, getOrSetCache, getCacheVersion, bumpCacheVersion, buildPaginatedKey } from '../lib/redis.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { createSaleProcess, fetchSaleById, cancelSaleProcess, updateSaleProcess } from '../services/sale.service.js';

// Venezuela = UTC-4. El backend corre en UTC (Vercel).
// Sin esta corrección, setHours(0,0,0,0) pondría la medianoche en UTC,
// causando un desfase de 4h → "Ayer" mostraría ventas del día equivocado.
const VE_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * Devuelve { start, end } en UTC correspondientes al inicio y fin
 * del día `offsetDays` relativo a hoy en hora Venezuela.
 * offsetDays = 0 → hoy VE, -1 → ayer VE, -6 → hace 6 días VE, etc.
 */
function dayRangeVE(offsetDays = 0) {
  const nowVE = new Date(Date.now() - VE_OFFSET_MS); // hora actual en VE como si fuera UTC
  const y = nowVE.getUTCFullYear();
  const m = nowVE.getUTCMonth();
  const d = nowVE.getUTCDate() + offsetDays;
  const start = new Date(Date.UTC(y, m, d,  0,  0,  0,   0) + VE_OFFSET_MS);
  const end   = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) + VE_OFFSET_MS);
  return { start, end };
}


export const createSale = async (req, res) => {
  try {
    const { items, payment_method, exchange_rate, branch_id } = req.body;

    // branchId: puede venir del body o del header X-Branch-Id (inyectado por middleware)
    const branchId = branch_id || req.branchId;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branch_id es requerido para registrar una venta.' });
    }

    // injectBusinessContext resolvió:
    //   req.businessOwnerId = ID del dueño del negocio (tenant)
    //   req.actorId = ID real de quien hizo login (empleado o dueño)
    const ownerId = req.businessOwnerId;
    const soldBy = req.actorId;

    const sale = await createSaleProcess(ownerId, soldBy, branchId, items, payment_method, exchange_rate);

    // Invalidar caché paginada de ventas y productos
    const keysToInvalidate = [];
    for (const item of items) {
      keysToInvalidate.push(`product:${item.product_id}:${ownerId}`);
    }
    await Promise.all([
      bumpCacheVersion('sales', ownerId),
      bumpCacheVersion('products', ownerId),
      keysToInvalidate.length > 0 ? invalidateCache(...keysToInvalidate) : Promise.resolve()
    ]);

    res.status(201).json({
      success: true,
      message: "Venta registrada exitosamente",
      sale
    });

  } catch (error) {
    let status = 500;
    if (error.message.includes('Stock insuficiente')) status = 400;
    else if (error.message.includes('no encontrado')) status = 404;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const getSales = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Usar contexto inyectado por injectBusinessContext (evita consulta redundante a DB)
    const isEmployee = req.userRole === 'employee';
    const ownerId = req.businessOwnerId; // Ya es el ID del dueño del negocio

    // Empleado: ve solo SUS ventas (sold_by) dentro del scope del dueño
    // Dueño:    ve todas las ventas de su negocio + filtro opcional por vendedor
    const sellerId = (!isEmployee && req.query.seller) ? req.query.seller : null;
    const paymentMethod = isEmployee ? null : (req.query.paymentMethod || null);

    // --- Resolver filtro de fechas ---
    let { dateFrom, dateTo } = req.query;
    let dateFilterParam = req.query.dateFilter; // today | 7days | 30days | month | custom | all

    // Restricciones para el empleado: solo ventas del día de hoy
    if (isEmployee) {
      dateFilterParam = 'today';
      dateFrom = null;
      dateTo = null;
    }
    let dateFilter = null;

    // Períodos rápidos → calcular rango en hora Venezuela (UTC-4)
    if (dateFilterParam && dateFilterParam !== 'all' && dateFilterParam !== 'custom') {

      if (dateFilterParam === 'today') {
        const { start, end } = dayRangeVE(0);
        dateFilter = { $gte: start, $lte: end };

      } else if (dateFilterParam === 'ayer') {
        const { start, end } = dayRangeVE(-1);
        dateFilter = { $gte: start, $lte: end };

      } else if (dateFilterParam === '7days') {
        const { start } = dayRangeVE(-6);
        const { end }   = dayRangeVE(0);
        dateFilter = { $gte: start, $lte: end };

      } else if (dateFilterParam === '30days') {
        const { start } = dayRangeVE(-29);
        const { end }   = dayRangeVE(0);
        dateFilter = { $gte: start, $lte: end };

      } else if (dateFilterParam === 'month') {
        const nowVE   = new Date(Date.now() - VE_OFFSET_MS);
        const firstDay = new Date(Date.UTC(nowVE.getUTCFullYear(), nowVE.getUTCMonth(), 1, 0, 0, 0, 0) + VE_OFFSET_MS);
        const { end } = dayRangeVE(0);
        dateFilter = { $gte: firstDay, $lte: end };
      }

      // Rango manual (custom) → usar dateFrom / dateTo
    } else if (dateFrom || dateTo) {
      dateFilter = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (!isNaN(from)) dateFilter.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (!isNaN(to)) {
          to.setHours(23, 59, 59, 999);
          dateFilter.$lte = to;
        }
      }
    }

    // Scope de caché separado por empleado para evitar cruzar datos entre usuarios
    const cacheScope = isEmployee ? `${ownerId}:emp:${req.actorId}` : ownerId;

    const version = await getCacheVersion('sales', String(ownerId));
    // Incluir el rango de fechas en el cache key para que no colisionen rangos distintos
    const dateSegment = dateFilterParam && dateFilterParam !== 'all'
      ? `:df${dateFilterParam}`
      : (dateFrom || dateTo ? `:df${dateFrom || ''}:dt${dateTo || ''}` : '');
    const cacheKey = buildPaginatedKey('sales', version, page, limit, cacheScope)
      + (sellerId ? `:s${sellerId}` : '')
      + (paymentMethod && paymentMethod !== 'all' ? `:pm${paymentMethod}` : '')
      + dateSegment;

    const { data, fromCache } = await getOrSetCache(cacheKey, async () => {
      let filter;

      if (isEmployee) {
        // Empleado: ventas donde ÉL fue el vendedor dentro del negocio del dueño
        filter = { customer_id: ownerId, sold_by: req.actorId };
      } else {
        // Dueño: todas las ventas de su negocio, con filtro opcional por vendedor
        filter = { customer_id: req.businessOwnerId };
        if (sellerId) filter.sold_by = sellerId;
      }

      // Aplicar rango de fechas al campo createdAt
      if (dateFilter) filter.createdAt = dateFilter;

      // Aplicar filtro de método de pago (exacto, gracias al enum estandarizado)
      if (paymentMethod && paymentMethod !== 'all') {
        filter.payment_method = paymentMethod;
      }

      // Para el aggregation pipeline es estrictamente necesario que los IDs sean ObjectId
      const aggFilter = { ...filter };
      if (aggFilter.customer_id) aggFilter.customer_id = new mongoose.Types.ObjectId(aggFilter.customer_id);
      if (aggFilter.sold_by) aggFilter.sold_by = new mongoose.Types.ObjectId(aggFilter.sold_by);

      const [sales, total, totalAmountAgg] = await Promise.all([
        Sale.find(filter)
          .populate('customer_id', 'name email')
          .populate('sold_by', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Sale.countDocuments(filter),
        Sale.aggregate([
          { $match: aggFilter },
          { $group: { _id: null, totalAmount: { $sum: "$total_amount" } } }
        ])
      ]);

      const totalAmount = totalAmountAgg.length > 0 ? totalAmountAgg[0].totalAmount : 0;

      return { sales, total, totalAmount, totalPages: Math.ceil(total / limit), currentPage: page };
    }, 120);

    res.status(200).json({
      success: true,
      sales: data.sales,
      total: data.total,
      totalAmount: data.totalAmount,
      totalPages: data.totalPages,
      currentPage: data.currentPage,
      fromCache
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Usar contexto inyectado por injectBusinessContext
    const isEmployee = req.userRole === 'employee';
    const cacheKey = `sale:${id}:${req.actorId}`;

    // Empleado → busca por sold_by (su ID real)
    // Dueño   → busca por customer_id (ownerId)
    const lookupId = isEmployee ? req.actorId : req.businessOwnerId;

    const { data, fromCache } = await getOrSetCache(cacheKey, () =>
      fetchSaleById(id, lookupId, isEmployee),
      300);

    if (!data) {
      return res.status(404).json({ success: false, message: "Venta no encontrada" });
    }

    res.status(200).json({ success: true, sale: data, fromCache });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelSale = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Restricción estricta: Los empleados no pueden anular ventas
    if (req.userRole === 'employee') {
      return res.status(403).json({ success: false, message: 'Los empleados no tienen permisos para anular ventas.' });
    }

    const ownerId = req.businessOwnerId;

    const cancelledSale = await cancelSaleProcess(id, ownerId);

    // Invalidar caché (ventas, productos y la venta específica)
    await Promise.all([
      bumpCacheVersion('sales', ownerId),
      bumpCacheVersion('products', ownerId),
      invalidateCache(`sale:${id}:${req.actorId}`)
    ]);

    res.status(200).json({
      success: true,
      message: 'Venta anulada exitosamente y stock restaurado',
      sale: cancelledSale
    });
  } catch (error) {
    res.status(error.message.includes('encontrada') ? 404 : 400).json({ success: false, message: error.message });
  }
};

export const updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, payment_method } = req.body;

    // Solo dueños pueden editar
    if (req.userRole === 'employee') {
      return res.status(403).json({ success: false, message: 'Los empleados no tienen permisos para editar ventas.' });
    }

    const ownerId = req.businessOwnerId;

    // El servicio transaccional maneja stock, SaleDetails y campos simples en una sola sesión ACID
    const updatedSale = await updateSaleProcess(id, ownerId, { items, payment_method });

    // Invalidar caché de ventas, productos (si hubo cambios de stock) y la venta individual
    await Promise.all([
      bumpCacheVersion('sales', ownerId),
      bumpCacheVersion('products', ownerId),
      invalidateCache(`sale:${id}:${req.actorId}`)
    ]);

    res.status(200).json({
      success: true,
      message: 'Venta actualizada exitosamente',
      sale: updatedSale
    });
  } catch (error) {
    let status = 500;
    if (error.message.includes('encontrada')) status = 404;
    else if (error.message.includes('insuficiente') || error.message.includes('anulada')) status = 400;
    res.status(status).json({ success: false, message: error.message });
  }
};
