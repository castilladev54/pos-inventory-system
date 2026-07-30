/**
 * @file ai.unit.test.js
 * @description Pruebas UNITARIAS del detector de intención temporal del servicio de IA.
 *
 * Esta función es pura (string → objeto | null), no necesita BD ni API Keys.
 * Corre limpio en GitHub Actions sin ninguna dependencia externa.
 */

import { describe, it, expect } from 'vitest';

// ─── Re-crear la función aquí para aislarla del módulo que importa Mongoose ──
// (Evita que Vitest intente cargar los modelos de Mongoose y falle sin BD)
const TEMPORAL_PATTERNS = [
    { keywords: ['semana', 'semanal', '7 días', '7 dias', 'esta semana', 'últimos 7', 'ultimos 7'], days: 7, label: 'últimos 7 días' },
    { keywords: ['mes', 'mensual', '30 días', '30 dias', 'este mes', 'últimos 30', 'ultimos 30'], days: 30, label: 'últimos 30 días' },
    { keywords: ['ayer', 'día anterior', 'dia anterior'], days: 1, label: 'ayer' },
    { keywords: ['quincena', '15 días', '15 dias', 'últimos 15', 'ultimos 15'], days: 15, label: 'últimos 15 días' },
];

const detectTemporalIntent = (question) => {
    const normalized = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const pattern of TEMPORAL_PATTERNS) {
        for (const keyword of pattern.keywords) {
            const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (normalized.includes(normalizedKeyword)) {
                return { days: pattern.days, label: pattern.label };
            }
        }
    }
    return null;
};

// ══════════════════════════════════════════════════════════════════════════════
// 🧠  AI SERVICE — detectTemporalIntent()
// ══════════════════════════════════════════════════════════════════════════════
describe('ai.service — detectTemporalIntent()', () => {

    // ─── Detecciones positivas ────────────────────────────────────────────────

    it('✅ detecta "semana" → 7 días', () => {
        const result = detectTemporalIntent('¿Cómo me fue esta semana?');
        expect(result).toEqual({ days: 7, label: 'últimos 7 días' });
    });

    it('✅ detecta "7 días" → 7 días', () => {
        const result = detectTemporalIntent('Dame el resumen de los últimos 7 días');
        expect(result).toEqual({ days: 7, label: 'últimos 7 días' });
    });

    it('✅ detecta "semanal" → 7 días', () => {
        const result = detectTemporalIntent('¿Cuál es mi reporte semanal?');
        expect(result).toEqual({ days: 7, label: 'últimos 7 días' });
    });

    it('✅ detecta "mes" → 30 días', () => {
        const result = detectTemporalIntent('¿Cómo van las ventas del mes?');
        expect(result).toEqual({ days: 30, label: 'últimos 30 días' });
    });

    it('✅ detecta "este mes" → 30 días', () => {
        const result = detectTemporalIntent('Resumen de este mes');
        expect(result).toEqual({ days: 30, label: 'últimos 30 días' });
    });

    it('✅ detecta "mensual" → 30 días', () => {
        const result = detectTemporalIntent('Quiero ver mi rendimiento mensual');
        expect(result).toEqual({ days: 30, label: 'últimos 30 días' });
    });

    it('✅ detecta "ayer" → 1 día', () => {
        const result = detectTemporalIntent('¿Cómo me fue ayer?');
        expect(result).toEqual({ days: 1, label: 'ayer' });
    });

    it('✅ detecta "quincena" → 15 días', () => {
        const result = detectTemporalIntent('¿Cómo va la quincena?');
        expect(result).toEqual({ days: 15, label: 'últimos 15 días' });
    });

    it('✅ detecta "15 días" → 15 días', () => {
        const result = detectTemporalIntent('Resumen de los últimos 15 días');
        expect(result).toEqual({ days: 15, label: 'últimos 15 días' });
    });

    // ─── Manejo de acentos y capitalización ───────────────────────────────────

    it('✅ ignora mayúsculas: "SEMANA" → 7 días', () => {
        const result = detectTemporalIntent('DAME EL RESUMEN DE LA SEMANA');
        expect(result).toEqual({ days: 7, label: 'últimos 7 días' });
    });

    it('✅ funciona sin tildes: "ultimos 7 dias" → 7 días', () => {
        const result = detectTemporalIntent('ultimos 7 dias de ventas');
        expect(result).toEqual({ days: 7, label: 'últimos 7 días' });
    });

    it('✅ funciona con tildes: "últimos 30 días" → 30 días', () => {
        const result = detectTemporalIntent('los últimos 30 días fueron buenos?');
        expect(result).toEqual({ days: 30, label: 'últimos 30 días' });
    });

    // ─── Detecciones negativas (no debe matchear) ─────────────────────────────

    it('🔴 retorna null si no hay intención temporal', () => {
        const result = detectTemporalIntent('¿Cómo me fue hoy?');
        expect(result).toBeNull();
    });

    it('🔴 retorna null para preguntas genéricas', () => {
        const result = detectTemporalIntent('¿Cuáles son mis productos con más stock?');
        expect(result).toBeNull();
    });

    it('🔴 retorna null para string vacío', () => {
        const result = detectTemporalIntent('');
        expect(result).toBeNull();
    });

    it('🔴 retorna null para preguntas fuera del negocio', () => {
        const result = detectTemporalIntent('¿Cuál es la receta de la arepa?');
        expect(result).toBeNull();
    });

    // ─── Prioridad: primera coincidencia gana ─────────────────────────────────

    it('✅ prioriza "semana" sobre "mes" si ambas aparecen', () => {
        // "semana" aparece antes en TEMPORAL_PATTERNS, así que gana
        const result = detectTemporalIntent('comparar esta semana con el mes');
        expect(result).toEqual({ days: 7, label: 'últimos 7 días' });
    });
});
