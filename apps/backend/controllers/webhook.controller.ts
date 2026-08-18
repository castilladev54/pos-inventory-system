import { Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User, ROLES } from '../models/User.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { redis } from '../lib/redis.js';
import { getCurrentLogger } from '../lib/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Esquema de validación estricta en tiempo de ejecución (Zod)
//    Previene TypeError fatales ante respuestas malformadas del servicio externo
//    (e.g. 502 Bad Gateway de Render).
// ─────────────────────────────────────────────────────────────────────────────
// Estructura real: https://siacm-be.onrender.com/api/bcv
// { data: { tasas: { USD: "773.31250000", ... }, fuente: "BCV", ... } }
const bcvApiResponseSchema = z.object({
  data: z.object({
    tasas: z.object({
      USD: z.union([z.string(), z.number()]),
    }),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Utilidad de zona horaria Venezuela (UTC-4)
//    Calcula el inicio del día actual en horario venezolano, devuelto como
//    Date UTC para que MongoDB lo almacene de forma consistente y sin deriva.
// ─────────────────────────────────────────────────────────────────────────────
const VE_OFFSET_MS = 4 * 60 * 60 * 1000;

function getStartOfDayVE(): Date {
  const nowVE = new Date(Date.now() - VE_OFFSET_MS);
  const y = nowVE.getUTCFullYear();
  const m = nowVE.getUTCMonth();
  const d = nowVE.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) + VE_OFFSET_MS);
}

function isNonEmptyArray<T>(arr: readonly T[]): arr is readonly [T, ...T[]] {
  return arr.length > 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. Controlador principal: POST /api/webhooks/bcv-sync
//
//    Flujo de ejecución:
//      [Auth]  → Validar x-worker-api-key con timingSafeEqual (anti timing-attack)
//      [Fetch] → Consumir API externa y validar payload con Zod
//      [DB]    → bulkWrite con upsert en transacción ACID (Mongoose Session)
//      [Cache] → Invalidar redis keys rate:today:{ownerId} en lotes de 50
//                (sin usar el comando bloqueante KEYS)
// ─────────────────────────────────────────────────────────────────────────────
export const syncBcvRate = async (req: Request, res: Response): Promise<void> => {
  const logger = getCurrentLogger();

  try {
    // ── [Auth] Timing-safe API key verification ─────────────────────────────
    const expectedApiKey = process.env.WORKER_API_KEY;
    const inputApiKey = req.headers['x-worker-api-key'];

    if (!expectedApiKey || !inputApiKey || typeof inputApiKey !== 'string') {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // SHA-256 de ambas claves para que timingSafeEqual reciba buffers de igual
    // longitud (32 bytes) y no lance una excepción de tamaño.
    const inputHash = createHash('sha256').update(inputApiKey).digest();
    const expectedHash = createHash('sha256').update(expectedApiKey).digest();

    if (!timingSafeEqual(inputHash, expectedHash)) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // ── [Fetch] Consumo y validación de la API externa ──────────────────────
    const apiResponse = await fetch('https://siacm-be.onrender.com/api/bcv');

    if (!apiResponse.ok) {
      res.status(502).json({
        success: false,
        message: `Failed to fetch external rate: ${apiResponse.statusText}`,
      });
      return;
    }

    const jsonBody = await apiResponse.json();
    const parsed = bcvApiResponseSchema.safeParse(jsonBody);

    if (!parsed.success) {
      logger.error(
        { err: parsed.error, body: jsonBody },
        'Invalid structure returned from external BCV API',
      );
      res.status(502).json({ success: false, message: 'Invalid payload from external BCV API' });
      return;
    }

    const rawUsdRate = parsed.data.data.tasas.USD;
    const usdRate = typeof rawUsdRate === 'string' ? parseFloat(rawUsdRate) : rawUsdRate;

    if (isNaN(usdRate) || usdRate <= 0) {
      logger.error({ usdRate }, 'Parsed exchange rate is not a valid number');
      res.status(502).json({ success: false, message: 'Parsed exchange rate is not valid' });
      return;
    }

    // ── [DB] Obtener tenants activos ─────────────────────────────────────────
    const tenants = await User.find({ role: { $in: [ROLES.ADMIN, ROLES.TENANT_OWNER] } })
      .select('_id')
      .lean();

    if (tenants.length === 0) {
      res.status(200).json({ success: true, message: 'No business accounts found' });
      return;
    }

    // ── [DB] Preparar operaciones bulkWrite (upsert por día + ownerId) ───────
    const startOfDay = getStartOfDayVE();
    const bulkOps = tenants.map((tenant) => ({
      updateOne: {
        filter: {
          customer_id: tenant._id,
          date: startOfDay,
          is_manual_override: { $ne: true },
        },
        update: { $set: { rate: usdRate }, $setOnInsert: { is_manual_override: false } },
        upsert: true,
      },
    }));

    // ── [DB] bulkWrite sin transacción (cada tenant es independiente) ────────
    // ordered: false → MongoDB ejecuta todas las ops aunque alguna falle.
    // Los DuplicateKeyError (E11000) son esperados: significan que ese tenant
    // ya tiene un override manual para hoy → el webhook lo respeta.
    try {
      const result = await ExchangeRate.bulkWrite(bulkOps, { ordered: false });

      logger.info(
        {
          usdRate,
          matched: result.matchedCount,
          upserted: result.upsertedCount,
          modified: result.modifiedCount,
        },
        'BCV rates sync completed',
      );
    } catch (bulkError: any) {
      // bulkWrite con ordered:false lanza BulkWriteError si hay fallos.
      // Filtramos: E11000 = override manual (esperado), otros = error real.
      if (bulkError?.code === 11000 || bulkError?.writeErrors?.every(
        (e: any) => e.code === 11000
      )) {
        const skipped = bulkError.writeErrors?.length ?? 0;
        logger.info(
          { usdRate, skippedByOverride: skipped, total: tenants.length },
          'BCV sync: some tenants skipped due to manual override (expected)',
        );
      } else {
        logger.error({ err: bulkError }, 'Unexpected bulkWrite error during BCV sync');
        res.status(500).json({ success: false, message: 'Database sync partially failed' });
        return;
      }
    }

    // ── [Cache] Invalidación via UNLINK por lotes en paralelo (Evita bloqueo y desbordamiento) ──
    // La transacción ya fue COMMITTED. Redis es una capa secundaria:
    // un fallo aquí no puede (ni debe) revertir escrituras ya confirmadas en BD.
    const cacheKeys = tenants.map((tenant) => `rate:today:${tenant._id}`);

    try {
      const CHUNK_SIZE = 500;
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < cacheKeys.length; i += CHUNK_SIZE) {
        const chunk = cacheKeys.slice(i, i + CHUNK_SIZE);
        if (isNonEmptyArray(chunk)) {
          const [firstKey, ...remainingKeys] = chunk;
          // Envolver en try/catch por si la construcción del comando lanza de forma síncrona
          try {
            promises.push(redis.unlink(firstKey, ...remainingKeys));
          } catch (syncErr) {
            promises.push(Promise.reject(syncErr));
          }
        }
      }

      if (promises.length > 0) {
        const results = await Promise.allSettled(promises);
        const failedBatches = results.filter((r) => r.status === 'rejected');

        if (failedBatches.length > 0) {
          logger.warn(
            { failedCount: failedBatches.length, totalBatches: results.length },
            'Some Redis cache invalidation batches failed — stale keys will auto-expire via TTL',
          );
        }
      }
    } catch (redisError) {
      logger.warn(
        { err: redisError, totalKeys: cacheKeys.length },
        'Redis cache invalidation failed — all cache keys may remain stale. ' +
        'DB write was already committed. Inconsistency is temporary (TTL-bound).',
      );
    }

    res.status(200).json({
      success: true,
      message: 'BCV rates successfully synced for all business accounts',
      rate: usdRate,
      synced: tenants.length,
    });

  } catch (error) {
    logger.error({ err: error }, 'Critical failure inside syncBcvRate controller');
    res.status(500).json({ success: false, message: 'Internal server error during sync' });
  }
};
