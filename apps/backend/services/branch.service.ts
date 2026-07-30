import { Branch } from '../models/Branch.js';
import { BranchInventory } from '../models/BranchInventory.js';
import { BusinessOwnerId, BranchId } from '../types/brands.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Actor {
  role: string;
  assignedBranches: string[];
}

// ─── Autorización de Acceso a Sucursal ───────────────────────────────────────

/**
 * Centraliza en un único lugar la lógica de acceso a una sucursal.
 * Aplica dos capas de seguridad:
 *   1. RBAC: Los empleados solo pueden tocar sus sucursales asignadas.
 *   2. Tenant isolation: La sucursal debe pertenecer al negocio autenticado.
 *
 * Lanza errores con códigos semánticos ('FORBIDDEN', 'NOT_FOUND') para que
 * el controlador los mapee a status HTTP sin lógica de negocio.
 *
 * @throws 'FORBIDDEN'  si el empleado no tiene acceso a la sucursal
 * @throws 'NOT_FOUND'  si la sucursal no existe o no pertenece al negocio
 */
export const authorizeAndFetchBranch = async (
  actor: Actor,
  branchId: string,
  ownerId: BusinessOwnerId
) => {
  // Capa 1: RBAC — los empleados solo ven sus sucursales asignadas
  if (actor.role === 'employee' && !actor.assignedBranches.includes(branchId)) {
    throw new Error('FORBIDDEN');
  }

  // Capa 2: Tenant isolation — la sucursal debe pertenecer al negocio
  const branch = await Branch.findOne({
    _id: branchId,
    owner_id: ownerId,
  }).lean();

  if (!branch) throw new Error('NOT_FOUND');

  return branch;
};

// ─── Inventario de Sucursal ───────────────────────────────────────────────────

/**
 * Obtiene el inventario de una sucursal, filtrando productos huérfanos
 * (cuyos documentos de Product ya fueron eliminados de la BD).
 */
export const fetchBranchInventory = async (branchId: BranchId) => {
  const inventory = await BranchInventory.find({ branch_id: branchId })
    .populate('product_id', 'name barcode price unit_type')
    .lean();

  // Blindaje: descarta registros con producto eliminado
  return inventory.filter(item => item.product_id !== null);
};

// ─── Listar Sucursales del Negocio ────────────────────────────────────────────

/**
 * Devuelve todas las sucursales del negocio, ordenadas por fecha de creación.
 */
export const fetchBranches = async (ownerId: BusinessOwnerId) => {
  return Branch.find({ owner_id: ownerId }).sort({ createdAt: -1 }).lean();
};

// ─── Obtener Sucursal por ID (con tenant isolation) ───────────────────────────

/**
 * Obtiene una sucursal específica del negocio.
 * @throws 'NOT_FOUND' si no existe o no pertenece al tenant
 */
export const fetchBranchById = async (branchId: string, ownerId: BusinessOwnerId) => {
  const branch = await Branch.findOne({
    _id: branchId,
    owner_id: ownerId,
  }).lean();

  if (!branch) throw new Error('NOT_FOUND');
  return branch;
};
