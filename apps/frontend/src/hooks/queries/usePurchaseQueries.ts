import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import API from '../../api/axios';
import type {
  Purchase,
  PurchaseId,
  PurchaseDbStatus,
  PurchaseWithDetails,
  PurchaseDetailItem,
} from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const purchaseKeys = {
  all: ['purchases'] as const,
  lists: () => [...purchaseKeys.all, 'list'] as const,
  list: (page: number, limit: number, status?: PurchaseDbStatus) =>
    [...purchaseKeys.lists(), { page, limit, status }] as const,
  details: () => [...purchaseKeys.all, 'detail'] as const,
  detail: (id: PurchaseId) => [...purchaseKeys.details(), id] as const,
  payments: () => [...purchaseKeys.all, 'payments'] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface PurchaseItemPayload {
  product_id: string;
  quantity: number;
  unit_cost: number;
}

export interface CreatePurchasePayload {
  supplier: string;
  dueDate?: string | null;
  items: PurchaseItemPayload[];
  exchange_rate?: number;
}

export interface AddPaymentPayload {
  amount: number;
}

interface PurchaseListResponse {
  purchases: Purchase[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export interface SupplierPayment {
  _id: string;
  purchase_id: string | { _id: string; supplier: string };
  amount: number;
  date?: string;
  createdAt: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function usePurchasesQuery(page: number, limit: number, status?: PurchaseDbStatus) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);

  return useQuery<PurchaseListResponse>({
    queryKey: purchaseKeys.list(page, limit, status),
    queryFn: async ({ signal }) => {
      const res = await API.get(`/purchases?${params.toString()}`, { signal });
      const data = res.data;
      return {
        purchases: data.purchases ?? data.data ?? (Array.isArray(data) ? data : []),
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
        currentPage: data.currentPage ?? page,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/**
 * Obtener detalles de una compra específica.
 * El backend devuelve { purchase, details } donde `details` son
 * los PurchaseDetail poblados con product_id.name.
 * Fusionamos `details` como `.items` dentro del Purchase para
 * que el componente pueda iterar directamente.
 */
export function usePurchaseDetailQuery(id: PurchaseId | null) {
  return useQuery<Purchase>({
    queryKey: purchaseKeys.detail(id as PurchaseId),
    queryFn: async ({ signal }) => {
      const res = await API.get(`/purchases/${id}`, { signal });
      const payload = res.data as PurchaseWithDetails | { purchase: Purchase };

      const purchase = (payload as PurchaseWithDetails).purchase ?? (res.data as Purchase);
      const details: PurchaseDetailItem[] = (payload as PurchaseWithDetails).details ?? [];

      // Inyectar items dentro del objeto purchase para consumo uniforme
      return { ...purchase, items: details };
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Obtener historial de pagos a proveedores */
export function usePurchasePaymentsQuery(global?: boolean) {
  return useQuery<SupplierPayment[]>({
    queryKey: [...purchaseKeys.payments(), { global }],
    queryFn: async ({ signal }) => {
      const headers: Record<string, string> = {};
      if (global) headers['x-global-request'] = 'true';

      const res = await API.get('/purchases/payments', { signal, headers });
      const data = res.data;
      return data.payments ?? data.data ?? (Array.isArray(data) ? data : []);
    },
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation<Purchase, Error, CreatePurchasePayload>({
    mutationFn: async (payload) => {
      const res = await API.post('/purchases', payload);
      return (res.data.purchase ?? res.data) as Purchase;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/** Registrar un abono a una compra */
export function useAddPaymentToPurchase() {
  const qc = useQueryClient();
  return useMutation<Purchase, Error, { id: PurchaseId; data: AddPaymentPayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await API.patch(`/purchases/${id}/payment`, data);
      return (res.data.purchase ?? res.data) as Purchase;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.invalidateQueries({ queryKey: purchaseKeys.detail(id) });
    },
  });
}

export function useDeletePurchase() {
  const qc = useQueryClient();
  return useMutation<void, Error, PurchaseId>({
    mutationFn: async (id) => {
      await API.delete(`/purchases/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
