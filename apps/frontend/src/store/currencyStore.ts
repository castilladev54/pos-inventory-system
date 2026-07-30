/**
 * currencyStore — Estado de UI para la moneda activa y tasa de visualización.
 *
 * IMPORTANTE: Este store ya NO realiza peticiones HTTP.
 * La obtención y persistencia de la tasa desde el servidor se gestiona
 * declarativamente en `src/hooks/queries/useExchangeRateQueries.ts`.
 *
 * Este store solo mantiene:
 *   - El valor numérico de la tasa para renderizado instantáneo en el POS.
 *   - La moneda de visualización activa (USD / VES).
 *   - Helpers de conversión sin efectos secundarios.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type DisplayCurrency = 'USD' | 'VES';

interface CurrencyState {
  /** Tasa de cambio activa: 1 USD = X Bs */
  exchangeRate: number;
  /** Moneda de visualización en el POS */
  displayCurrency: DisplayCurrency;

  // Actions
  setExchangeRate: (rate: number) => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;

  // Helpers de conversión (sin efectos secundarios)
  toBs: (usdAmount: number) => number;
  formatDual: (usdAmount: number) => { usd: string; bs: string };
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      exchangeRate: 95.0,
      displayCurrency: 'USD',

      setExchangeRate: (rate) => {
        const parsed = parseFloat(String(rate));
        if (!isNaN(parsed) && parsed > 0) {
          set({ exchangeRate: parsed });
        }
      },

      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),

      toBs: (usdAmount) => {
        const rate = get().exchangeRate;
        return Number((usdAmount * rate).toFixed(2));
      },

      formatDual: (usdAmount) => {
        const rate = get().exchangeRate;
        const bs = Number((usdAmount * rate).toFixed(2));
        return {
          usd: Number(usdAmount).toFixed(2),
          bs: bs.toFixed(2),
        };
      },
    }),
    {
      name: 'currency-store',
      // Solo persiste la tasa y la moneda de visualización
      partialize: (state) => ({
        exchangeRate: state.exchangeRate,
        displayCurrency: state.displayCurrency,
      }),
    }
  )
);
