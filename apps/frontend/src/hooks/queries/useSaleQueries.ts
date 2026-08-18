import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import API from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { exchangeRateKeys } from './useExchangeRateQueries';
import type {
  Sale,
  SaleId,
  PaymentMethod,
  ProductId,
  SaleDetailDTO,
} from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const saleKeys = {
  all: (branchId: string | null) => ['sales', branchId] as const,
  lists: (branchId: string | null) => [...saleKeys.all(branchId), 'list'] as const,
  list: (branchId: string | null, filters: SaleQueryFilters) => [...saleKeys.lists(branchId), filters] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface SaleItemPayload {
  product_id: ProductId;
  quantity: number;
  unit_price: number;
}

export interface CreateSalePayload {
  items: SaleItemPayload[];
  payment_method: PaymentMethod;
  exchange_rate?: number | null;
  signal?: AbortSignal;
}

export interface UpdateSalePayload {
  total_amount?: number;
  payment_method?: PaymentMethod;
  items?: SaleItemPayload[];
}

export interface SaleQueryFilters {
  page: number;
  limit: number;
  seller?: string | null;
  dateFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  global?: boolean;
}

interface SaleListResponse {
  sales: Sale[];
  total: number;
  totalPages: number;
  currentPage: number;
  totalAmount?: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useSalesQuery(filters: SaleQueryFilters) {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
  });
  if (filters.seller) params.set('seller', filters.seller);
  if (filters.dateFilter && filters.dateFilter !== 'all') params.set('dateFilter', filters.dateFilter);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.paymentMethod && filters.paymentMethod !== 'all') params.set('paymentMethod', filters.paymentMethod);

  return useQuery<SaleListResponse>({
    queryKey: saleKeys.list(activeBranchId, filters),
    queryFn: async ({ signal }) => {
      const headers: Record<string, string> = {};
      if (filters.global) headers['x-global-request'] = 'true';

      const res = await API.get(`/sales?${params.toString()}`, { signal, headers });
      const data = res.data;
      return {
        sales: data.sales ?? data.data ?? (Array.isArray(data) ? data : []),
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
        currentPage: data.currentPage ?? filters.page,
        totalAmount: data.totalAmount ?? 0,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000, // 2 minutos — alineado con TTL de Redis del backend
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateSale() {
  const qc = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return useMutation<Sale, Error, CreateSalePayload>({
    mutationFn: async ({ signal, ...payload }) => {
      const res = await API.post('/sales', payload, { signal });
      return (res.data.sale ?? res.data) as Sale;
    },
    onSuccess: () => {
      // Una venta descuenta stock → invalida productos + ventas + analytics
      qc.invalidateQueries({ queryKey: saleKeys.all(activeBranchId) });
      qc.invalidateQueries({ queryKey: ['products', activeBranchId] });
    },
    onError: (error: any) => {
      // Recuperación automática JIT: Si la tasa de cambio cambió, invalidamos la tasa para forzar un refetch.
      if (error?.response?.status === 409 && error?.response?.data?.error === 'EXCHANGE_RATE_MISMATCH') {
        qc.invalidateQueries({ queryKey: exchangeRateKeys.all });
      }
    },
  });
}

/** Cancelar una venta — el backend devuelve el stock y marca is_cancelled: true */
export function useCancelSale() {
  const qc = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return useMutation<Sale, Error, SaleId>({
    mutationFn: async (id) => {
      const res = await API.put(`/sales/${id}/cancel`); // Nota: El store legacy usa PUT /sales/:id/cancel
      return (res.data.sale ?? res.data) as Sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: saleKeys.all(activeBranchId) });
      qc.invalidateQueries({ queryKey: ['products', activeBranchId] }); // stock regresa al inventario
    },
  });
}

/** Actualizar una venta (Editar venta) */
export function useUpdateSale() {
  const qc = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return useMutation<Sale, Error, { id: SaleId; data: UpdateSalePayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await API.patch(`/sales/${id}`, data);
      return (res.data.sale ?? res.data) as Sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: saleKeys.all(activeBranchId) });
      qc.invalidateQueries({ queryKey: ['products', activeBranchId] });
    },
  });
}
