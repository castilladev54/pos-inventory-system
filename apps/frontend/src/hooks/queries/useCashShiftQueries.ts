import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../api/axiosClient';
import type { ICashShift } from '@inventory/shared';
import type { BranchId, CashShiftId, UserId } from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const cashShiftKeys = {
  all: ['cash-shifts'] as const,
  current: (branchId: BranchId | null, userId: UserId | null) =>
    [...cashShiftKeys.all, 'current', branchId, userId] as const,
  history: (branchId: BranchId | null) =>
    [...cashShiftKeys.all, 'history', branchId] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface OpenCashShiftPayload {
  opening_balance: string;
}

export interface CloseCashShiftPayload {
  closing_balance: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Obtiene el turno de caja actual (si está abierto) para la sucursal activa y el cajero actual */
export function useCurrentCashShiftQuery(branchId: BranchId | null, userId: UserId | undefined) {
  return useQuery<ICashShift | null>({
    queryKey: cashShiftKeys.current(branchId, userId ?? null),
    queryFn: async ({ signal }) => {
      if (!branchId || !userId) return null;
      try {
        const res = await api.get('/api/shifts/active', { signal });
        const payload = res.data;
        return (payload.shift !== undefined ? payload.shift : (payload.data !== undefined ? payload.data : payload)) as ICashShift | null;
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null; // No hay turno abierto
        }
        throw error;
      }
    },
    enabled: !!branchId && !!userId,
    staleTime: 1000 * 60, // 1 minuto
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Abre un nuevo turno de caja */
export function useOpenCashShift() {
  const qc = useQueryClient();
  return useMutation<ICashShift, Error, { branchId: BranchId; userId: UserId; payload: OpenCashShiftPayload }>({
    mutationFn: async ({ payload }) => {
      const res = await api.post('/api/shifts/open', payload);
      const data = res.data;
      return (data.shift !== undefined ? data.shift : (data.data !== undefined ? data.data : data)) as ICashShift;
    },
    onSuccess: (_, { branchId, userId }) => {
      qc.invalidateQueries({ queryKey: cashShiftKeys.current(branchId, userId) });
    },
  });
}

/** Cierra el turno de caja actual */
export function useCloseCashShift() {
  const qc = useQueryClient();
  return useMutation<ICashShift, Error, { shiftId: CashShiftId; branchId: BranchId; userId: UserId; payload: CloseCashShiftPayload }>({
    mutationFn: async ({ payload }) => {
      // The backend expects /api/shifts/close, shiftId is obtained by the backend via cashier_id + branch_id in token
      const res = await api.post(`/api/shifts/close`, payload);
      const data = res.data;
      return (data.shift !== undefined ? data.shift : (data.data !== undefined ? data.data : data)) as ICashShift;
    },
    onSuccess: (_, { branchId, userId }) => {
      qc.invalidateQueries({ queryKey: cashShiftKeys.current(branchId, userId) });
    },
  });
}
