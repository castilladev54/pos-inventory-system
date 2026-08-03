import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../api/axiosClient';
import { useAuthStore } from '../../store/authStore';
import type { IStockTransfer } from '@inventory/shared';
import type { BranchId, StockTransferId } from '@inventory/shared';

export const stockTransferKeys = {
  all: ['stock-transfers'] as const,
  list: (branchId: BranchId | null) => [...stockTransferKeys.all, 'list', branchId] as const,
  detail: (id: StockTransferId) => [...stockTransferKeys.all, 'detail', id] as const,
};

export interface CreateStockTransferPayload {
  destination_branch_id: BranchId;
  items: { product_id: string; quantity: number }[];
  notes?: string;
}

export interface UpdateStockTransferStatusPayload {
  status: 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
}

/** Obtiene las transferencias asociadas a la sucursal activa (como origen o destino) */
export function useStockTransfersQuery(branchId: BranchId | null) {
  return useQuery<IStockTransfer[]>({
    queryKey: stockTransferKeys.list(branchId),
    queryFn: async ({ signal }) => {
      if (!branchId) return [];
      const res = await api.get('/api/stock-transfers', { signal });
      return res.data.transfers ?? res.data.data ?? res.data;
    },
    enabled: !!branchId,
  });
}

/** Crea una nueva transferencia de stock */
export function useCreateStockTransfer() {
  const qc = useQueryClient();
  return useMutation<IStockTransfer, Error, CreateStockTransferPayload>({
    mutationFn: async (payload) => {
      const res = await api.post('/api/stock-transfers', payload);
      return res.data.transfer ?? res.data.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockTransferKeys.all });
    },
  });
}

/** Actualiza el estado de una transferencia (Recibir, Rechazar, Cancelar) */
export function useUpdateStockTransferStatus() {
  const qc = useQueryClient();
  return useMutation<IStockTransfer, Error, { id: StockTransferId; payload: UpdateStockTransferStatusPayload }>({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/api/stock-transfers/${id}/status`, payload);
      return res.data.transfer ?? res.data.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockTransferKeys.all });
      // Invalidar productos porque el stock ha cambiado
      qc.invalidateQueries({ queryKey: ['products', useAuthStore.getState().activeBranchId] });
    },
  });
}
