/**
 * currencyStore — Estado de UI para la moneda activa y tasa de visualización.
 *
 * IMPORTANTE: Este store ya NO realiza peticiones HTTP.
 * La obtención y persistencia de la tasa desde el servidor se gestiona
 * declarativamente en `src/hooks/queries/useExchangeRateQueries.ts`.
 *
 * Este store solo mantiene:
 *   - La moneda de visualización activa (USD / VES).
 */

import { create } from 'zustand';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type DisplayCurrency = 'USD' | 'VES';

interface CurrencyState {
  /** Moneda de visualización en el POS */
  displayCurrency: DisplayCurrency;

  // Actions
  setDisplayCurrency: (currency: DisplayCurrency) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCurrencyStore = create<CurrencyState>()((set) => ({
  displayCurrency: 'USD',
  setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
}));
