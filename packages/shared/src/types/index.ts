/**
 * @inventory/shared — Tipos compartidos entre Backend y Frontend
 *
 * 💡 FUENTE DE VERDAD ÚNICA para tipos, interfaces y enums del dominio.
 * Ambas apps importan desde aquí — nunca duplicar tipos manualmente.
 */

// ─── BRANDED TYPES ──────────────────────────────────────────────────────────
// Seguridad nominal en tiempo de compilación.
// Evita la asignación accidental entre distintos tipos de IDs de MongoDB.
// Usa `string` como base (agnóstico de Mongoose) para funcionar en ambos entornos.

declare const brand: unique symbol;
export type Brand<T, TBrand> = T & { readonly [brand]: TBrand };

export type BusinessOwnerId = Brand<string, 'BusinessOwnerId'>;
export type UserId = Brand<string, 'UserId'>;
export type BranchId = Brand<string, 'BranchId'>;
export type ProductId = Brand<string, 'ProductId'>;
export type CategoryId = Brand<string, 'CategoryId'>;
export type InventoryAdjustmentId = Brand<string, 'InventoryAdjustmentId'>;
export type SaleId = Brand<string, 'SaleId'>;
export type PurchaseId = Brand<string, 'PurchaseId'>;
export type CashShiftId = Brand<string, 'CashShiftId'>;
export type StockTransferId = Brand<string, 'StockTransferId'>;

// ─── ROLES Y PERMISOS (SaaS Multi-tenant) ──────────────────────────────────

export type UserRole = 'admin' | 'customer' | 'employee';

export type UserPermission =
  | 'pos_access'
  | 'inventory_access'
  | 'purchases_access'
  | 'staff_management'
  | 'finances_access';

export interface UserProfile {
  _id: UserId;
  name: string;
  email: string;
  role: UserRole;
  permissions: UserPermission[];
  customer_id: BusinessOwnerId;
  salesStats?: {
    transactionCount: number;
    totalVolumeUSD: number;
  };
}

// ─── SUCURSALES ─────────────────────────────────────────────────────────────

export interface Branch {
  _id: BranchId;
  name: string;
  address?: string;
  owner_id: BusinessOwnerId;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── CATEGORÍAS ─────────────────────────────────────────────────────────────

export interface Category {
  _id: CategoryId;
  name: string;
  user: BusinessOwnerId;
}

// ─── INVENTARIO POR SUCURSAL ────────────────────────────────────────────────

export interface BranchInventory {
  _id: string;
  branch_id: BranchId;
  product_id: ProductId;
  stock: number;
  min_stock: number;
  createdAt: string;
  updatedAt: string;
}

// ─── PRODUCTO ───────────────────────────────────────────────────────────────

export type UnitType = 'unidad' | 'kg' | 'litro' | 'metro';

export interface Product {
  _id: ProductId;
  id: ProductId;
  name: string;
  description: string;
  barcode?: string;
  price: number;
  category: CategoryId | Category;
  unit_type: UnitType;
  user: BusinessOwnerId;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
  branchInventories: BranchInventory[];
  totalStock: number;
}

// ─── COMPRAS A PROVEEDORES ──────────────────────────────────────────────────

export type PurchaseDbStatus = 'PENDING' | 'PARTIAL' | 'PAID';

export interface PurchaseDetailItem {
  _id: string;
  purchase_id: PurchaseId;
  product_id: ProductId | { _id: ProductId; name: string };
  quantity: number;
  unit_cost: number;
  createdAt?: string;
}

export interface Purchase {
  _id: PurchaseId;
  admin_id: UserId | { _id: UserId; name: string; email: string };
  branch_id: BranchId;
  supplier: string;
  total_cost: number;
  paid_amount: number;
  status: PurchaseDbStatus;
  due_date?: string;
  dueDate?: string;
  exchange_rate?: number | null;
  payment_date?: string;
  date?: string;
  createdAt: string;
  updatedAt?: string;
  items?: PurchaseDetailItem[];
}

export interface PurchaseWithDetails {
  purchase: Purchase;
  details: PurchaseDetailItem[];
}

// ─── VENTAS (POS/TPV) ──────────────────────────────────────────────────────

export type PaymentMethod =
  | 'Efectivo'
  | 'Divisas'
  | 'Tarjeta'
  | 'Pago Movil'
  | 'Pago Móvil'
  | 'Transferencia'
  | 'Zelle'
  | 'Punto de Venta';

export interface SaleItem {
  product_id: ProductId;
  quantity: number;
  unit_price: number;
}

export interface Sale {
  _id: SaleId;
  total_amount: number;
  exchange_rate: number | null;
  payment_method: PaymentMethod;
  status: 'pending' | 'completed' | 'cancelled' | 'Anulada';
  sold_by: UserId | { _id: UserId; name: string } | null;
  branch_id: BranchId;
  items: SaleItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface SaleDetailItemDTO {
  product_id: {
    _id: ProductId;
    name: string;
    unit_type?: string;
  } | null;
  quantity: number;
  unit_price: number;
}

export interface SaleDetailDTO {
  _id: SaleId;
  total_amount: number;
  exchange_rate: number | null;
  payment_method: PaymentMethod;
  status: 'pending' | 'completed' | 'cancelled' | 'Anulada';
  sold_by: { _id: UserId; name: string } | null;
  branch_id: BranchId;
  items: SaleDetailItemDTO[];
  createdAt: string;
  updatedAt?: string;
}

// ─── AJUSTES DE INVENTARIO ──────────────────────────────────────────────────

export type AdjustmentReason =
  | 'initial_count'
  | 'merma'
  | 'robo'
  | 'vencimiento'
  | 'correccion';

/** Razones de ajuste usadas en validaciones Zod del backend */
export type AdjustmentReasonBackend =
  | 'initial_count'
  | 'damaged'
  | 'stolen'
  | 'expired'
  | 'correction'
  | 'other';

export interface InventoryAdjustment {
  _id: InventoryAdjustmentId;
  actor_id: UserId;
  branch_id: BranchId;
  product_id: ProductId;
  quantity: number;
  reason: AdjustmentReason;
  comment: string;
  createdAt: string;
}

// ─── TASAS DE CAMBIO ────────────────────────────────────────────────────────

export interface ExchangeRate {
  _id: string;
  customer_id: BusinessOwnerId;
  rate: number;
  date: string;
  createdAt: string;
}

// ─── RESPUESTAS DE API ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  fromCache?: boolean;
  data: T;
}

export interface ApiProductResponse {
  success: boolean;
  product: Product;
  message?: string;
  fromCache?: boolean;
}

export interface ApiProductListResponse {
  success: boolean;
  products: Product[];
  pagination?: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
  };
}

// ─── TURNO DE CAJA ──────────────────────────────────────────────────────────

interface MultiCurrencyAmount {
  USD: number;
  COP: number;
  BS: number;
}

export interface ICashShift {
  _id: CashShiftId;
  branch_id: BranchId;
  user_id: UserId;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string;

  initial_cash: MultiCurrencyAmount;

  system_summary: {
    cash_sales: MultiCurrencyAmount;
    card_sales: MultiCurrencyAmount;
    transfer_sales: MultiCurrencyAmount;
    cash_inflows: MultiCurrencyAmount;
    cash_outflows: MultiCurrencyAmount;
    expected_cash: MultiCurrencyAmount;
  };

  declared_amounts?: {
    cash: MultiCurrencyAmount;
    card_bouchers: MultiCurrencyAmount;
    transfers: MultiCurrencyAmount;
  };

  discrepancy?: {
    cash_difference: MultiCurrencyAmount;
    card_difference: MultiCurrencyAmount;
    has_discrepancy: boolean;
    notes?: string;
  };
}

// ─── TRANSFERENCIAS DE STOCK ────────────────────────────────────────────────

export interface StockTransferItem {
  product_id: ProductId | Product;
  quantity: number;
}

export interface IStockTransfer {
  _id: StockTransferId;
  customer_id: BusinessOwnerId;
  source_branch_id: BranchId | Branch;
  destination_branch_id: BranchId | Branch;
  created_by: UserId | UserProfile;
  received_by?: UserId | UserProfile;
  items: StockTransferItem[];
  status: 'PENDING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── CONSTANTES REUTILIZABLES ───────────────────────────────────────────────
// Estas constantes se usan tanto para validaciones Zod como para UIs.

export const UNIT_TYPES = ['unidad', 'kg', 'litro', 'metro'] as const;

export const PAYMENT_METHODS = [
  'Efectivo',
  'Divisas',
  'Tarjeta',
  'Pago Movil',
  'Transferencia',
  'Zelle',
] as const;

export const ADJUSTMENT_REASONS_BACKEND = [
  'initial_count',
  'damaged',
  'stolen',
  'expired',
  'correction',
  'other',
] as const;

export const STOCK_CORRECTION_REASONS = [
  'initial_count',
  'damaged',
  'stolen',
  'expired',
  'correction',
  'other',
] as const;

/** Patrón regex para validar MongoDB ObjectId (24 chars hex) */
export const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
