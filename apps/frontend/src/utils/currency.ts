/**
 * currency.ts — Motor matemático financiero de precisión absoluta.
 *
 * Patrón: Wrapper sobre big.js que encapsula toda la aritmética decimal.
 * PROHIBIDO: pasar `number` a cualquier función. Todo entra y sale como `string`.
 *
 * Principio DRY: Los componentes llaman MoneyMath.add(a, b) sin conocer big.js.
 * Principio DIP: Si big.js queda obsoleto, solo se modifica este archivo.
 */
import Big from 'big.js';

// Redondeo: ROUND_HALF_UP (bancario) como default global
Big.RM = Big.roundHalfUp;

export const MoneyMath = {
  /** Suma: "12.30" + "0.70" = "13.00" */
  add: (a: string, b: string): string => Big(a).plus(Big(b)).toString(),

  /** Resta: "100.00" - "30.50" = "69.50" */
  sub: (a: string, b: string): string => Big(a).minus(Big(b)).toString(),

  /** Multiplicación (price × quantity): "10.50" × "3" = "31.50" */
  mul: (a: string, b: string): string => Big(a).times(Big(b)).toString(),

  /**
   * División para CÁLCULOS INTERMEDIOS (Backend o agregaciones puras)
   * NO trunca ni redondea.
   * @param a Dividendo
   * @param b Divisor
   * @returns String con la precisión matemática exacta máxima.
   * @throws Error si divisor es cero
   */
  divExact: (a: string, b: string): string => {
    const divisor = Big(b);
    if (divisor.eq(0)) {
      throw new Error('[MoneyMath] División por cero en cálculo intermedio.');
    }
    return Big(a).div(divisor).toString();
  },

  /**
   * División para PRESENTACIÓN O PERSISTENCIA FINAL.
   * Aplica redondeo estricto a N decimales (default 2).
   * @param a Dividendo
   * @param b Divisor
   * @param decimals Decimales para el redondeo final.
   * @throws Error si divisor es cero
   */
  divForDisplay: (a: string, b: string, decimals: number = 2): string => {
    const divisor = Big(b);
    if (divisor.eq(0)) {
      throw new Error('[MoneyMath] División por cero en operación de formato.');
    }
    return Big(a).div(divisor).toFixed(decimals, 1);
  },

  /** Suma un array de strings */
  sum: (values: string[]): string =>
    values.reduce((acc, val) => acc.plus(Big(val)), Big('0')).toString(),

  // ── Comparadores ──────────────────────────────────────────────────
  isGreaterThan:    (a: string, b: string): boolean => Big(a).gt(Big(b)),
  isLessThan:       (a: string, b: string): boolean => Big(a).lt(Big(b)),
  isEqual:          (a: string, b: string): boolean => Big(a).eq(Big(b)),
  isGreaterOrEqual: (a: string, b: string): boolean => Big(a).gte(Big(b)),
  isLessOrEqual:    (a: string, b: string): boolean => Big(a).lte(Big(b)),

  /** Valor absoluto */
  abs: (a: string): string => Big(a).abs().toString(),

  /** Formato fijo a N decimales (para display) */
  formatToDisplay: (a: string, decimals: number = 2): string => Big(a).toFixed(decimals, 1),

  /** ¿Es cero o menor que cero? */
  isZeroOrNegative: (a: string): boolean => Big(a).lte(Big('0')),

  /** Constante cero como string */
  ZERO: '0' as const,
} as const;

// ── Utilidades de Moneda (usan MoneyMath internamente) ──────────────

export const toBs = (amount: string, rate: string): string => {
  const safeAmount = amount || "0";
  const safeRate = rate || "0";

  try {
    return MoneyMath.formatToDisplay(MoneyMath.mul(safeAmount, safeRate), 2);
  } catch {
    return "0.00";
  }
};

export const formatDual = (amount: string, rate: string): string => {
  const safeAmount = amount || "0";
  const bs = toBs(safeAmount, rate);
  try {
    return `$${MoneyMath.formatToDisplay(safeAmount, 2)} / Bs ${bs}`;
  } catch {
    return `$0.00 / Bs 0.00`;
  }
};
