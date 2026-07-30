import { invalidateCache, getOrSetCache, bumpCacheVersion, getCacheVersion, buildPaginatedKey } from '../lib/redis.js';
import { createPurchaseProcess, fetchPurchases, fetchPurchasesCount, fetchPurchaseById, registerPayment, fetchPayments } from '../services/purchase.service.js';

export const createPurchase = async (req, res) => {
  try {
    const { supplier, items, dueDate, exchange_rate, branch_id } = req.body;

    const branchId = branch_id || req.branchId;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branch_id es requerido para registrar una compra.' });
    }

    const purchase = await createPurchaseProcess(req.businessOwnerId, branchId, supplier, items, dueDate, exchange_rate);

    // Invalidar caché de compras y productos
    const individualKeysToInvalidate = [];
    for (const item of items) {
      individualKeysToInvalidate.push(`product:${item.product_id}:${req.businessOwnerId}`);
    }
    await Promise.all([
      bumpCacheVersion('purchases', req.businessOwnerId),
      bumpCacheVersion('products', req.businessOwnerId),
      individualKeysToInvalidate.length > 0
        ? invalidateCache(...individualKeysToInvalidate)
        : Promise.resolve()
    ]);

    res.status(201).json({
      success: true,
      message: "Compra registrada exitosamente",
      purchase
    });

  } catch (error) {
    const status = error.message.includes("encontrado") ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const getPurchases = async (req, res) => {
  try {
    // ─── Paginación con defaults seguros ────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const { status, filterBy } = req.query;
    const filters = {};

    if (status) filters.status = status;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filterBy === 'expiringSoon') {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      filters.status   = { $ne: 'PAID' };
      filters.due_date = { $gte: today, $lte: nextWeek };
    } else if (filterBy === 'overdue') {
      filters.status   = { $ne: 'PAID' };
      filters.due_date = { $lt: today };
    }

    const hasFilters = status || filterBy;

    // ─── Consultas filtradas: van directo a MongoDB (no cacheables por patrón) ─
    // No podemos invalidar por patrón en Upstash REST → consultamos directo
    if (hasFilters) {
      const [purchases, total] = await Promise.all([
        fetchPurchases(req.businessOwnerId, filters, skip, limit),
        fetchPurchasesCount(req.businessOwnerId, filters)
      ]);
      return res.status(200).json({
        success: true,
        purchases,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      });
    }

    // ─── Consulta sin filtros: caché versionada ──────────────────────────
    const version  = await getCacheVersion('purchases', req.businessOwnerId);
    const cacheKey = buildPaginatedKey('purchases', version, page, limit, req.businessOwnerId);

    const { data, fromCache } = await getOrSetCache(cacheKey, async () => {
      const [purchases, total] = await Promise.all([
        fetchPurchases(req.businessOwnerId, {}, skip, limit),
        fetchPurchasesCount(req.businessOwnerId, {})
      ]);
      return {
        purchases,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    }, 120); // TTL 2 min

    // Protección: página fuera de rango
    if (data.currentPage > data.totalPages && data.totalPages > 0) {
      return res.status(200).json({
        success: true,
        purchases: [],
        total: data.total,
        totalPages: data.totalPages,
        currentPage: page,
        fromCache
      });
    }

    res.status(200).json({
      success: true,
      purchases: data.purchases,
      total: data.total,
      totalPages: data.totalPages,
      currentPage: data.currentPage,
      fromCache
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fetchPurchaseById(id, req.businessOwnerId);

    if (!data) {
      return res.status(404).json({ success: false, message: "Compra no encontrada" });
    }

    res.status(200).json({
      success: true,
      purchase: data.purchase,
      details: data.details
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const payPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "El monto debe ser mayor a cero." });
    }

    const purchase = await registerPayment(id, req.businessOwnerId, amount);

    // Invalidar caché de compras con el sistema versionado para que la lista refleje el pago
    // También eliminar la clave individual de esta compra
    await Promise.all([
      bumpCacheVersion('purchases', req.businessOwnerId),
      invalidateCache(`purchase:${id}:${req.businessOwnerId}`)
    ]);

    res.status(200).json({
      success: true,
      message: "Pago registrado exitosamente",
      purchase
    });
  } catch (error) {
    const status = error.message.includes("encontrada") ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const getPayments = async (req, res) => {
  try {
    const payments = await fetchPayments(req.businessOwnerId);
    res.status(200).json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
