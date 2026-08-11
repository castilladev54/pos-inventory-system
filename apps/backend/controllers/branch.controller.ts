import { Request, Response } from 'express';
import { redis } from '../lib/redis.js';
import { Branch } from '../models/Branch.js';
import { createAdjustmentProcess } from '../services/adjustment.service.js';
import {
  authorizeAndFetchBranch,
  fetchBranchInventory,
  fetchBranches,
  fetchBranchById,
} from '../services/branch.service.js';
import { BranchId, ProductId } from '../types/brands.js';
import { isValidObjectId } from '../utils/validateObjectId.js';

// Helper: mapea los errores semánticos del servicio a status HTTP
const handleServiceError = (error: unknown, res: Response): void => {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  if (message === 'FORBIDDEN') {
    res.status(403).json({ success: false, message: 'Acceso denegado.' });
    return;
  }
  if (message === 'NOT_FOUND') {
    res.status(404).json({ success: false, message: 'Sucursal no encontrada.' });
    return;
  }
  res.status(500).json({ success: false, message });
};

// ─── Listar Sucursales ────────────────────────────────────────────────────────

/**
 * GET /api/branches
 * Devuelve todas las sucursales activas del negocio autenticado. 
 */
export const getBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = {
      role: req.userRole,
      assignedBranches: req.assignedBranches
    };

    const branches = await fetchBranches(req.businessOwnerId, actor);
    res.status(200).json({ success: true, data: branches });
  } catch (error) {
    handleServiceError(error, res);
  }
};

// ─── Obtener Sucursal por ID ──────────────────────────────────────────────────

/**
 * GET /api/branches/:id
 * Devuelve una sucursal específica del negocio.
 */
export const getBranchById = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id as string;

    if (!isValidObjectId(rawId)) {
      res.status(400).json({ success: false, message: 'ID de sucursal inválido.' });
      return;
    }

    const branch = await fetchBranchById(rawId, req.businessOwnerId);
    res.status(200).json({ success: true, data: branch });
  } catch (error) {
    handleServiceError(error, res);
  }
};

// ─── Crear Sucursal ───────────────────────────────────────────────────────────

/**
 * POST /api/branches
 * Crea una nueva sucursal para el negocio autenticado.
 * Body: { name, address, phone? }
 */
export const createBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, address, phone } = req.body as {
      name: string;
      address: string;
      phone?: string;
    };

    if (!name || !address) {
      res.status(400).json({ success: false, message: 'Los campos name y address son requeridos.' });
      return;
    }

    const branch = new Branch({
      name,
      address,
      phone,
      owner_id: req.businessOwnerId,
      is_active: true,
    });

    await branch.save();

    // Invalidate Redis Zero-Trust Gateway cache
    try {
      await redis.del(`tenant:branches:${req.businessOwnerId}`);
    } catch (redisError) {
      // Ignorar error de redis, el TTL eventualmente limpiará el caché viejo
    }

    res.status(201).json({ success: true, data: branch });
  } catch (error) {
    handleServiceError(error, res);
  }
};

// ─── Actualizar Sucursal ──────────────────────────────────────────────────────

/**
 * PATCH /api/branches/:id
 * Actualiza los datos editables de una sucursal (name, address, phone, is_active).
 */
export const updateBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, address, phone, is_active } = req.body as {
      name?: string;
      address?: string;
      phone?: string;
      is_active?: boolean;
    };

    const branch = await Branch.findOneAndUpdate(
      { _id: req.params.id, owner_id: req.businessOwnerId },
      { $set: { name, address, phone, is_active } },
      { new: true, runValidators: true }
    );

    if (!branch) {
      res.status(404).json({ success: false, message: 'Sucursal no encontrada.' });
      return;
    }

    res.status(200).json({ success: true, data: branch });
  } catch (error) {
    handleServiceError(error, res);
  }
};

// ─── Eliminar (desactivar) Sucursal ──────────────────────────────────────────

/**
 * DELETE /api/branches/:id
 * Soft-delete: marca is_active = false en lugar de borrar físicamente.
 */
export const deleteBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const branch = await Branch.findOneAndUpdate(
      { _id: req.params.id, owner_id: req.businessOwnerId },
      { $set: { is_active: false } },
      { new: true }
    );

    if (!branch) {
      res.status(404).json({ success: false, message: 'Sucursal no encontrada.' });
      return;
    }

    // Invalidate Redis Zero-Trust Gateway cache
    try {
      await redis.del(`tenant:branches:${req.businessOwnerId}`);
    } catch (redisError) {
      // Ignorar error de redis
    }

    res.status(200).json({ success: true, message: 'Sucursal desactivada exitosamente.', data: branch });
  } catch (error) {
    handleServiceError(error, res);
  }
};

// ─── Inventario de una Sucursal ───────────────────────────────────────────────

/**
 * GET /api/branches/:id/inventory
 * Devuelve los ítems de inventario de una sucursal específica.
 */
export const getBranchInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id as string;

    if (!isValidObjectId(rawId)) {
      res.status(400).json({ success: false, message: 'ID de sucursal inválido.' });
      return;
    }

    const branchId = rawId as unknown as BranchId;

    // Autorización RBAC + tenant isolation (un solo lugar en el servicio)
    await authorizeAndFetchBranch(
      { role: req.userRole, assignedBranches: req.assignedBranches },
      rawId,
      req.businessOwnerId
    );

    const data = await fetchBranchInventory(branchId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(error, res);
  }
};

// ─── Ajustar Stock en Sucursal ────────────────────────────────────────────────

/**
 * PATCH /api/branches/:id/inventory
 * Ajusta el stock de un producto en la sucursal indicada.
 * Body: { product_id, new_stock, reason, notes? }
 *
 * IMPORTANTE: Toda modificación de stock pasa por createAdjustmentProcess,
 * que escribe en BranchInventory Y genera un registro en el Kardex (InventoryAdjustment).
 * Ningún cambio de inventario puede evadir la auditoría.
 */
export const upsertBranchInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id as string;

    if (!isValidObjectId(rawId)) {
      res.status(400).json({ success: false, message: 'ID de sucursal inválido.' });
      return;
    }

    const branchId = rawId as unknown as BranchId;

    // Autorización RBAC + tenant isolation (un solo lugar en el servicio)
    await authorizeAndFetchBranch(
      { role: req.userRole, assignedBranches: req.assignedBranches },
      rawId,
      req.businessOwnerId
    );

    const { product_id, new_stock, reason, notes } = req.body as {
      product_id: string;
      new_stock: number;
      reason: string;
      notes?: string;
    };

    if (!product_id || new_stock === undefined || !reason) {
      res.status(400).json({ success: false, message: 'product_id, new_stock y reason son requeridos.' });
      return;
    }

    // Delegar en el servicio transaccional — escribe en BranchInventory y genera Kardex
    const adjustment = await createAdjustmentProcess(
      req.actorId,
      req.businessOwnerId,
      branchId,
      product_id as unknown as ProductId,
      new_stock,
      reason,
      notes ?? ''
    );

    res.status(200).json({ success: true, data: adjustment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    if (message === 'FORBIDDEN') {
      res.status(403).json({ success: false, message: 'Acceso denegado.' });
      return;
    }
    if (message === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Sucursal no encontrada.' });
      return;
    }
    const status = message.includes('igual') || message.includes('encontrado') ? 400 : 500;
    res.status(status).json({ success: false, message });
  }
};
