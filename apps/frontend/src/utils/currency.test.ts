import { describe, it, expect } from 'vitest';
import { MoneyMath } from './currency';

describe('Financial Regression Tests: MoneyMath Core', () => {
  it('Debe resolver de raíz el error IEEE 754 de coma flotante en Javascript', () => {
    // Escenario clásico de Javascript donde 0.1 + 0.2 === 0.30000000000000004
    // MoneyMath debe devolver el string inmutable '0.3'
    const result = MoneyMath.add('0.1', '0.2');
    expect(result).toBe('0.3');
  });

  it('Debe evitar desbordamientos en cálculos intermedios (divExact)', () => {
    // 10 / 3 tiene decimales infinitos. El cálculo interno no debe perder precisión.
    const exact = MoneyMath.divExact('10', '3');
    // Big.js por defecto evalúa a una precisión alta, garantizando +10 decimales.
    expect(exact.length).toBeGreaterThan(10);
    expect(exact.startsWith('3.333333')).toBe(true);
  });

  it('Debe redondear correctamente para persistencia o UI (divForDisplay - ROUND_HALF_UP bancario)', () => {
    const displayResult = MoneyMath.divForDisplay('10', '3', 2);
    expect(displayResult).toBe('3.33');

    // Prueba de redondeo hacia arriba: 10 / 6 = 1.666... -> 1.67
    const roundUpResult = MoneyMath.divForDisplay('10', '6', 2);
    expect(roundUpResult).toBe('1.67');
  });

  it('Debe soportar lógica matemática booleana segura', () => {
    expect(MoneyMath.isGreaterThan('0.3', '0.29')).toBe(true);
    expect(MoneyMath.isZeroOrNegative('-0.01')).toBe(true);
    expect(MoneyMath.isZeroOrNegative('0')).toBe(true);
  });
});
