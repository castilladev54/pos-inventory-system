import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import API from '../../api/axios';
import { RateSchema } from '../../schemas/rateSchema';
import type { ExchangeRate } from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const exchangeRateKeys = {
  all: ['exchange-rate'] as const,
  today: () => [...exchangeRateKeys.all, 'today'] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface SaveExchangeRatePayload {
  rate: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Tasa de cambio del día para el tenant activo */
export function useExchangeRateQuery() {
  return useQuery<ExchangeRate | null>({
    queryKey: exchangeRateKeys.today(),
    queryFn: async ({ signal }) => {
      const res = await API.get('/rates/today', { 
        signal,
        headers: { 'x-global-request': 'true' }
      });
      const { rate, date, is_manual_override } = res.data;

      // Si no hay tasa registrada, retornar null
      if (rate === null || rate === undefined) return null;

      return {
        _id: res.data._id ?? '',
        customer_id: res.data.customer_id ?? '',
        rate: String(rate),
        date: date ?? new Date().toISOString(),
        is_manual_override: is_manual_override ?? false,
        createdAt: res.data.createdAt ?? '',
      } as ExchangeRate;
    },
    staleTime: 86_400_000,       // 24 h
    gcTime: 2 * 86_400_000,      // 48 h
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Guarda o actualiza la tasa de cambio del día */
export function useSaveExchangeRate() {
  const qc = useQueryClient();
  return useMutation<ExchangeRate, Error, SaveExchangeRatePayload>({
    mutationFn: async (payload) => {
      const res = await API.post('/rates', { rate: payload.rate });
      return (res.data.exchangeRate ?? res.data) as ExchangeRate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exchangeRateKeys.all });
    },
  });
}
