
# Plan de Implementación: Webhook BCV Sync (Fase B)

Este plan describe la arquitectura, seguridad e integración del Webhook BCV Sync para actualizar automáticamente la tasa cambiaria diaria de todos los negocios en el sistema.

---

## 1. Desafíos Técnicos y Resoluciones de Diseño

### 1.1 Prevención de timing attacks en API Keys
Para la autenticación del header `x-worker-api-key`, utilizaremos `crypto.timingSafeEqual`. Dado que este método requiere que ambos buffers tengan la misma longitud para evitar excepciones en tiempo de ejecución, aplicaremos primero un hash SHA-256 (`crypto.createHash('sha256')`) a ambas claves. Los digests resultantes siempre medirán 32 bytes, garantizando que `timingSafeEqual` se ejecute de manera segura y constante.

### 1.2 Eliminación de KEYS en Redis (O(1) Memory Invalidation)
En lugar de ejecutar `KEYS rate:today:*` (operación bloqueante de O(N) que degrada el rendimiento de Redis), generaremos los nombres de las claves directamente en memoria usando el listado de IDs de negocios (`rate:today:${ownerId}`) que ya consultamos para la base de datos. Invalidaremos estas claves llamando a `redis.del(...chunk)` en lotes de 50.

### 1.3 Validación en Tiempo de Ejecución (Zod)
Para prevenir errores de tipo fatales (`TypeError`) ante caídas o respuestas de error del servicio de Render (e.g. 502 Bad Gateway), usaremos un esquema de `Zod` para validar estructuralmente el payload JSON antes de abrir transacciones o tocar la base de datos.

### 1.4 Transacciones ACID & Replica Sets
Las transacciones de MongoDB requieren estar en un Replica Set. En el entorno de pruebas local, `mongodb-memory-server` ya está configurado o puede inicializarse en modo de réplica. Para entornos de desarrollo local Docker/Standalone, se documentará la necesidad de iniciar MongoDB con `--replSet rs0`.

---

## 2. Implementación Propuesta del Controlador

### [NEW] `controllers/webhook.controller.ts`

```typescript
import { Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { redis } from '../lib/redis.js';
import { getCurrentLogger } from '../lib/logger.js';

// 1. Esquema de validación estricta en tiempo de ejecución
const bcvApiResponseSchema = z.object({
  data : z.boolean(),
  tasas: z.object({
    USD: z.string().or(z.number()),
  }),
});

const VE_OFFSET_MS = 4 * 60 * 60 * 1000;

function getStartOfDayVE() {
  const nowVE = new Date(Date.now() - VE_OFFSET_MS);
  const y = nowVE.getUTCFullYear();
  const m = nowVE.getUTCMonth();
  const d = nowVE.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) + VE_OFFSET_MS);
}

export const syncBcvRate = async (req: Request, res: Response): Promise<void> => {
  const logger = getCurrentLogger();
  
  try {
    // 2. Intercepción de seguridad (Timing Attack Resistant)
    const expectedApiKey = process.env.WORKER_API_KEY;
    const inputApiKey = req.headers['x-worker-api-key'];

    if (!expectedApiKey || !inputApiKey || typeof inputApiKey !== 'string') {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const inputHash = createHash('sha256').update(inputApiKey).digest();
    const expectedHash = createHash('sha256').update(expectedApiKey).digest();

    if (!timingSafeEqual(inputHash, expectedHash)) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // 3. Consumo y Validación de la API Externa (Zod)
    const apiResponse = await fetch('https://siacm-be.onrender.com/api/rates/today');
    if (!apiResponse.ok) {
      res.status(502).json({ success: false, message: `Failed to fetch external rate: ${apiResponse.statusText}` });
      return;
    }

    const jsonBody = await apiResponse.json();
    const parsed = bcvApiResponseSchema.safeParse(jsonBody);

    if (!parsed.success) {
      logger.error({ err: parsed.error, body: jsonBody }, "Invalid structure returned from external BCV API");
      res.status(502).json({ success: false, message: "Invalid payload from external BCV API" });
      return;
    }

    const rawUsdRate = parsed.data.rates.USD;
    const usdRate = typeof rawUsdRate === 'string' ? parseFloat(rawUsdRate) : rawUsdRate;

    if (isNaN(usdRate) || usdRate <= 0) {
      logger.error({ usdRate }, "Parsed exchange rate is not a valid number");
      res.status(502).json({ success: false, message: "Parsed exchange rate is not valid" });
      return;
    }

    // 4. Obtener todos los dueños de negocio (tenants) activos
    const tenants = await User.find({ role: { $in: ['admin', 'customer'] } }).select('_id').lean();
    if (tenants.length === 0) {
      res.status(200).json({ success: true, message: 'No business accounts found' });
      return;
    }

    // 5. Preparar operaciones bulkWrite
    const startOfDay = getStartOfDayVE();
    const bulkOps = tenants.map((tenant) => ({
      updateOne: {
        filter: { customer_id: tenant._id, date: startOfDay },
        update: { rate: usdRate },
        upsert: true,
      },
    }));

    // 6. Transacción ACID (Mongoose Session)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await ExchangeRate.bulkWrite(bulkOps, { session });
      await session.commitTransaction();
      logger.info({ usdRate, count: tenants.length }, "BCV rates successfully synced at database level");
    } catch (dbError) {
      await session.abortTransaction();
      logger.error({ err: dbError }, "Transaction aborted due to database sync error");
      res.status(500).json({ success: false, message: "Database sync failed" });
      return;
    } finally {
      await session.endSession();
    }

    // 7. Invalidación estructurada de caché (sin usar KEYS) en lotes de 50
    const cacheKeys = tenants.map((tenant) => `rate:today:${tenant._id}`);
    const chunkSize = 50;

    for (let i = 0; i < cacheKeys.length; i += chunkSize) {
      const chunk = cacheKeys.slice(i, i + chunkSize);
      await redis.del(...chunk).catch((err) => {
        logger.error({ err, chunk }, "Failed to clear cache block for sync update");
      });
    }

    res.status(200).json({ success: true, message: "BCV rates successfully synced for all business accounts", rate: usdRate });

  } catch (error) {
    logger.error({ err: error }, "Critical failure inside syncBcvRate controller");
    res.status(500).json({ success: false, message: "Internal server error during sync" });
  }
};
```

---

## 3. Rutas y Registro de Rutas

### [NEW] `routes/webhook.route.ts`

```typescript
import { Router } from 'express';
import { syncBcvRate } from '../controllers/webhook.controller.js';

const router = Router();

// Endpoint público protegido a nivel de API Key (x-worker-api-key)
router.post('/bcv-sync', syncBcvRate);

export default router;
```

---

## 4. Plan de Verificación

### Pruebas Automatizadas
- Añadir tests unitarios/integración en `tests/webhook.test.ts` para validar:
  - Rechazo ante `x-worker-api-key` inválido o ausente.
  - Sincronización exitosa e inserción de tasas correctas.
  - Comportamiento ante fallos de base de datos (verificación de rollback exitoso).
  - Invalidación correcta de claves en la simulación de Redis.
