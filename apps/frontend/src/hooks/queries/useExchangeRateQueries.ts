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
  rate: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Tasa de cambio del día para el tenant activo */
export function useExchangeRateQuery() {
  return useQuery<ExchangeRate | null>({
    queryKey: exchangeRateKeys.today(),
    queryFn: async ({ signal }) => {
      const res = await API.get('/rates/today', { signal });
      const data = res.data.rate ?? res.data;
      if (data === null || (typeof data === 'object' && Object.keys(data).length === 0)) return null;

      const parsed = RateSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(`Rate payload validation failed: ${parsed.error.message}`);
      }
      return parsed.data as ExchangeRate;
    },
    staleTime: 86_400_000,       // 24 h
    gcTime: 2 * 86_400_000,      // 48 h
    refetchOnWindowFocus: false, // Sin refetch al cambiar pestaña
    refetchOnMount: false,       // Sin refetch al montar componente
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
