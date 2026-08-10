import {
  invalidateCache,
  getOrSetCache,
  getCacheVersion,
  bumpCacheVersion,
  buildPaginatedKey
} from '../lib/redis.js';
import { createAdjustmentProcess, fetchAdjustments, fetchAdjustmentsCount } from '../services/adjustment.service.js';

export const createAdjustment = async (req, res) => {
  try {
    const { product_id, new_stock, reason, notes, branch_id } = req.body;

    const branchId = branch_id || req.branchId;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branch_id es requerido para realizar un ajuste.' });
    }

    const adjustment = await createAdjustmentProcess(
      req.actorId,
      req.businessOwnerId,
      branchId,
      product_id,
      new_stock,
      reason,
      notes
    );

    // Invalidar caché versionada de ajustes y productos
    await Promise.all([
      bumpCacheVersion('adjustments', req.businessOwnerId),
      invalidateCache(`product:${product_id}:${req.businessOwnerId}`)
    ]);

    res.status(201).json({
      success: true,
      message: "Ajuste de inventario realizado correctamente",
      adjustment
    });

  } catch (error) {
    console.error("Error in createAdjustment: ", error);
    const status = error.message.includes("encontrado") || 
                   error.message.includes("igual") || 
                   error.message.includes("inactiva") ||
                   error.message.includes("existe") 
                   ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const getAdjustments = async (req, res) => {
  try {
    // ─── Paginación con defaults seguros ────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    // ─── Caché versionada (invalida en bloque al crear/editar ajuste) ───
    const version  = await getCacheVersion('adjustments', req.businessOwnerId);
    const cacheKey = buildPaginatedKey('adjustments', version, page, limit, req.businessOwnerId);

    const { data, fromCache } = await getOrSetCache(cacheKey, async () => {
      const [adjustments, total] = await Promise.all([
        fetchAdjustments(req.businessOwnerId, skip, limit),
        fetchAdjustmentsCount(req.businessOwnerId)
      ]);

      return {
        adjustments,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    }, 300); // TTL 5 min

    // Protección: página fuera de rango → devolver vacío sin error
    if (data.currentPage > data.totalPages && data.totalPages > 0) {
      return res.status(200).json({
        success: true,
        adjustments: [],
        total: data.total,
        totalPages: data.totalPages,
        currentPage: page,
        fromCache
      });
    }

    res.status(200).json({
      success: true,
      adjustments: data.adjustments,
      total: data.total,
      totalPages: data.totalPages,
      currentPage: data.currentPage,
      fromCache
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
