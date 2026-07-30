import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import API from '../../api/axios';
import type { ExchangeRate } from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const exchangeRateKeys = {
  all: ['exchange-rate'] as const,
  today: () => [...exchangeRateKeys.all, 'today'] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface SaveExchangeRatePayload {
  rate: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Tasa de cambio del día para el tenant activo */
export function useExchangeRateQuery() {
  return useQuery<ExchangeRate | null>({
    queryKey: exchangeRateKeys.today(),
    queryFn: async ({ signal }) => {
      try {
        const res = await API.get('/rates/today', { signal });
        const data = res.data;
        return (data.rate ?? data) as ExchangeRate;
      } catch {
        // Si no hay tasa registrada hoy, retornamos null (no un error)
        return null;
      }
    },
    staleTime: 60 * 60_000, // 1 hora — la tasa es única por día en el backend
    gcTime: 24 * 60 * 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Guarda o actualiza la tasa de cambio del día */
export function useSaveExchangeRate() {
  const qc = useQueryClient();
  return useMutation<ExchangeRate, Error, SaveExchangeRatePayload>({
    mutationFn: async (payload) => {
      const res = await API.post('/webhooks/bcv-sync', { rate: payload.rate });
      return (res.data.rate ?? res.data) as ExchangeRate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exchangeRateKeys.all });
    },
  });
}
