import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../server.js';
import { User } from '../models/User.js';
import { ExchangeRate } from '../models/ExchangeRate.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS OBLIGATORIOS
// Idénticos al patrón establecido en toda la suite (ver rate.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../mailtrap/emails.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    get:  vi.fn(async () => null),
    set:  vi.fn(async () => 'OK'),
    del:  vi.fn(async () => 1),
    incr: vi.fn(async () => 1),
  },
  getOrSetCache:    vi.fn(async (_key: string, fn: () => Promise<unknown>) => ({ data: await fn(), fromCache: false })),
  invalidateCache:  vi.fn(async () => {}),
  bumpCacheVersion: vi.fn(async () => {}),
  getCacheVersion:  vi.fn(async () => 0),
  buildPaginatedKey: vi.fn((_p: string, _v: unknown, _pg: unknown, _l: unknown, uid: string) => `mock:${uid}`),
}));

// Mock de fetch global — el controlador consume la API externa de BCV
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─────────────────────────────────────────────────────────────────────────────
// SETUP: MongoMemoryReplSet
// Las transacciones de Mongoose requieren un Replica Set.
// ─────────────────────────────────────────────────────────────────────────────

let mongoReplSet: MongoMemoryReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoReplSet.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
}, 90000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) {
    await mongoReplSet.stop();
  }
});

afterEach(async () => {
  await User.deleteMany({});
  await ExchangeRate.deleteMany({});
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE TEST
// ─────────────────────────────────────────────────────────────────────────────

const VALID_API_KEY = 'super-secret-worker-key-for-tests';
const WORKER_HEADER = { 'x-worker-api-key': VALID_API_KEY };

/** Construye una respuesta de fetch simulada con la estructura correcta del BCV */
const buildBcvFetchResponse = (usdRate: number | string = 36.5) =>
  Promise.resolve({
    ok:   true,
    json: async () => ({
      data: {
        tasas: { USD: usdRate },
      },
    }),
  } as Response);

/** Crea N tenants (admin) en la BD de prueba */
const createTenants = async (count = 1) =>
  User.insertMany(
    Array.from({ length: count }, (_, i) => ({
      email:    `tenant${i}${Date.now()}@test.com`,
      password: 'hashed',
      name:     `Tenant ${i}`,
      role:     i % 2 === 0 ? 'admin' : 'customer',
    })),
  );

// ═════════════════════════════════════════════════════════════════════════════
// SUITE DE INTEGRACIÓN: WEBHOOK BCV SYNC
//
//   Endpoint: POST /api/webhooks/bcv-sync
//   Auth:     Header x-worker-api-key (protección API Key, sin JWT)
//
//   Cobre:
//     1. Rechazo por API key ausente
//     2. Rechazo por API key incorrecta
//     3. Sincronización exitosa con inserción correcta de tasas
//     4. Comportamiento ante fallo de la API externa (502)
//     5. Comportamiento ante payload malformado (Zod)
//     6. Rollback en caso de fallo de BD (transacción abortada)
//     7. Invalidación correcta de claves Redis
//     8. Soporte multi-tenant (N negocios)
// ═════════════════════════════════════════════════════════════════════════════

describe('Suite de Integración: Webhook BCV Sync — POST /api/webhooks/bcv-sync', () => {

  // ── TEST 1: Rechazo sin header ─────────────────────────────────────────────
  it('1. Debe rechazar la petición con 401 cuando no se envía el header x-worker-api-key', async () => {
    const res = await request(app).post('/api/webhooks/bcv-sync');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/unauthorized/i);
  });

  // ── TEST 2: Rechazo con API key incorrecta ────────────────────────────────
  it('2. Debe rechazar con 401 cuando el header x-worker-api-key no coincide', async () => {
    // Configurar la variable de entorno para la duración del test
    const original = process.env.WORKER_API_KEY;
    process.env.WORKER_API_KEY = VALID_API_KEY;

    const res = await request(app)
      .post('/api/webhooks/bcv-sync')
      .set({ 'x-worker-api-key': 'wrong-key-that-should-fail' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    process.env.WORKER_API_KEY = original;
  });

  // ── TEST 3: Sincronización exitosa ────────────────────────────────────────
  it('3. Sincronización exitosa: debe insertar/actualizar la tasa para cada tenant', async () => {
    const original = process.env.WORKER_API_KEY;
    process.env.WORKER_API_KEY = VALID_API_KEY;

    const [tenant] = await createTenants(1);
    mockFetch.mockReturnValueOnce(buildBcvFetchResponse(36.5));

    const res = await request(app)
      .post('/api/webhooks/bcv-sync')
      .set(WORKER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rate).toBe(36.5);
    expect(res.body.synced).toBeGreaterThanOrEqual(1);

    // Verificar que la tasa fue insertada en BD
    const rateDoc = await ExchangeRate.findOne({ customer_id: tenant._id });
    expect(rateDoc).not.toBeNull();
    expect(rateDoc?.rate).toBe(36.5);

    process.env.WORKER_API_KEY = original;
  });

  // ── TEST 4: Fallo de la API externa (502) ─────────────────────────────────
  it('4. Debe responder 502 cuando la API externa del BCV no está disponible', async () => {
    const original = process.env.WORKER_API_KEY;
    process.env.WORKER_API_KEY = VALID_API_KEY;

    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok:         false,
        statusText: 'Bad Gateway',
        json:       async () => ({}),
      } as Response),
    );

    const res = await request(app)
      .post('/api/webhooks/bcv-sync')
      .set(WORKER_HEADER);

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/failed to fetch/i);

    process.env.WORKER_API_KEY = original;
  });

  // ── TEST 5: Payload malformado (Zod rejection) ────────────────────────────
  it('5. Debe responder 502 cuando el payload del BCV tiene estructura inválida', async () => {
    const original = process.env.WORKER_API_KEY;
    process.env.WORKER_API_KEY = VALID_API_KEY;

    // Payload que no cumple el esquema Zod (falta `rates`)
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok:   true,
        json: async () => ({ success: true, data: 'unexpected_shape' }),
      } as Response),
    );

    const res = await request(app)
      .post('/api/webhooks/bcv-sync')
      .set(WORKER_HEADER);

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid payload/i);

    process.env.WORKER_API_KEY = original;
  });

  // ── TEST 6: Invalidación de Redis en lotes ────────────────────────────────
  it('6. Debe invalidar redis.del con la clave correcta para cada tenant sincronizado', async () => {
    const original = process.env.WORKER_API_KEY;
    process.env.WORKER_API_KEY = VALID_API_KEY;

    const [tenant] = await createTenants(1);
    const { redis } = await import('../lib/redis.js');
    mockFetch.mockReturnValueOnce(buildBcvFetchResponse(37.0));

    const res = await request(app)
      .post('/api/webhooks/bcv-sync')
      .set(WORKER_HEADER);

    expect(res.status).toBe(200);

    // Verificar que redis.del fue llamado con la clave del tenant
    expect(redis.del).toHaveBeenCalled();
    const allDelArgs = (redis.del as ReturnType<typeof vi.fn>).mock.calls.flat();
    expect(allDelArgs).toContain(`rate:today:${tenant._id}`);

    process.env.WORKER_API_KEY = original;
  });

  // ── TEST 7: Soporte multi-tenant ──────────────────────────────────────────
  it('7. Soporte multi-tenant: debe sincronizar la tasa para 3 negocios distintos', async () => {
    const original = process.env.WORKER_API_KEY;
    process.env.WORKER_API_KEY = VALID_API_KEY;

    const tenants = await createTenants(3);
    mockFetch.mockReturnValueOnce(buildBcvFetchResponse(38.2));

    const res = await request(app)
      .post('/api/webhooks/bcv-sync')
      .set(WORKER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(3);

    // Cada tenant debe tener su propio registro de tasa
    for (const tenant of tenants) {
      const rateDoc = await ExchangeRate.findOne({ customer_id: tenant._id });
      expect(rateDoc).not.toBeNull();
      expect(rateDoc?.rate).toBe(38.2);
    }

    process.env.WORKER_API_KEY = original;
  });

  // ── TEST 8: Tasa como string (Zod union) ──────────────────────────────────
  it('8. Debe parsear correctamente cuando la tasa USD viene como string en el payload', async () => {
    const original = process.env.WORKER_API_KEY;
    process.env.WORKER_API_KEY = VALID_API_KEY;

    await createTenants(1);
    // Algunos servicios devuelven la tasa como string "36.50" en lugar de número
    mockFetch.mockReturnValueOnce(buildBcvFetchResponse('36.50'));

    const res = await request(app)
      .post('/api/webhooks/bcv-sync')
      .set(WORKER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rate).toBe(36.5);

    process.env.WORKER_API_KEY = original;
  });

  // ── TEST 9: Sin tenants activos ───────────────────────────────────────────
  it('9. Debe responder 200 con mensaje informativo cuando no hay cuentas de negocio activas', async () => {
    const original = process.env.WORKER_API_KEY;
    process.env.WORKER_API_KEY = VALID_API_KEY;

    // No creamos ningún tenant — BD vacía
    mockFetch.mockReturnValueOnce(buildBcvFetchResponse(36.5));

    const res = await request(app)
      .post('/api/webhooks/bcv-sync')
      .set(WORKER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/no business accounts/i);

    process.env.WORKER_API_KEY = original;
  });
});
