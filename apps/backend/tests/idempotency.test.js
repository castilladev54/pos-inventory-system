process.env.MONGOMS_STARTUP_TIME = "60000";
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { randomUUID as uuidv4 } from 'crypto';

// Crear mock stateful para probar idempotencia
const { mockRedisStore } = vi.hoisted(() => ({ mockRedisStore: new Map() }));

vi.mock('../mailtrap/emails.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async (key) => mockRedisStore.get(key) || null),
    set: vi.fn(async (key, value, options) => {
      if (options && options.nx) {
        if (mockRedisStore.has(key)) return null; // No adquirió el lock
        mockRedisStore.set(key, value);
        return 'OK'; // Adquirió el lock
      }
      mockRedisStore.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key) => {
      mockRedisStore.delete(key);
      return 1;
    }),
  },
  getOrSetCache: vi.fn(async (_key, fn) => ({ data: await fn(), fromCache: false })),
  invalidateCache: vi.fn(async () => { }),
  bumpCacheVersion: vi.fn(async () => { }),
  getCacheVersion: vi.fn(async () => 0),
  buildPaginatedKey: vi.fn((_p, _v, _pg, _l, uid) => `mock:${uid}`),
}));

import app from '../server.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Branch } from '../models/Branch.ts';
import { CashShift } from '../models/CashShift.model.ts';
import { Inventory } from '../models/Inventory.ts';
import bcryptjs from 'bcryptjs';
import { getAuthHeadersForUser } from './helpers/auth.js';

let mongoReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoReplSet.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
  await new Promise((r) => setTimeout(r, 1500));
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) {
    await mongoReplSet.stop();
  }
});

afterEach(async () => {
  mockRedisStore.clear(); // Limpiar el store entre tests
  await Sale.deleteMany({});
  await SaleDetail.deleteMany({});
  await Product.deleteMany({});
  await Inventory.deleteMany({});
  vi.clearAllMocks();
});

describe('Idempotency Lifecycle Tests (Phase 7)', () => {
  let authHeaders;
  let userId;
  let categoryId;
  let productId;
  let branchId;
  let shiftId;

  beforeAll(async () => {
    const testEmail = `idem${Date.now()}@example.com`;
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const user = await User.create({
      email: testEmail,
      password: hashedPassword,
      name: 'Idempotency Tester',
      role: 'admin'
    });
    userId = user._id.toString();

    authHeaders = getAuthHeadersForUser(user._id, user.role);

    const category = await Category.create({ name: 'Tech', user: userId });
    categoryId = category._id.toString();

    const branch = await Branch.create({
      name: 'Sucursal Idempotencia',
      address: 'Calle Falsa 123',
      owner_id: userId,
      is_active: true
    });
    branchId = branch._id.toString();

    const shift = await CashShift.create({
      branch_id: branchId,
      user_id: userId,
      status: 'OPEN',
      opening_balance: 100
    });
    shiftId = shift._id.toString();
  });

  beforeEach(async () => {
    const product = await Product.create({
      name: 'Monitor',
      price: 200,
      unit_type: 'unidad',
      category: categoryId,
      user: userId
    });
    productId = product._id.toString();

    await Inventory.create({
      owner_id: userId,
      product_id: product._id,
      branch_id: branchId,
      quantity: 10,
      min_quantity: 0
    });
  });

  it('Caso A — Venta normal (Idempotency success)', async () => {
    const uuidA = uuidv4();
    const payload = {
      customer_id: userId,
      payment_method: 'Tarjeta',
      branch_id: branchId,
      items: [{ product_id: productId, quantity: 1, unit_price: 200 }]
    };

    // Primera petición: debe crear la venta
    const res1 = await request(app)
      .post('/api/sales')
      .set({ ...authHeaders, 'x-branch-id': branchId, 'x-shift-id': shiftId, 'x-idempotency-key': uuidA })
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.sale.total_amount).toBe('200');

    // Segunda petición con la misma llave: debe devolver 200 y la misma respuesta sin crear otra venta
    const res2 = await request(app)
      .post('/api/sales')
      .set({ ...authHeaders, 'x-branch-id': branchId, 'x-shift-id': shiftId, 'x-idempotency-key': uuidA })
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.headers['x-idempotent-replay']).toBe('true');
    expect(res2.body.sale._id).toBe(res1.body.sale._id);

    // Comprobamos que solo hay 1 venta en base de datos
    const totalSales = await Sale.countDocuments();
    expect(totalSales).toBe(1);
  });

  it('Caso B — Validación inválida limpia el cerrojo', async () => {
    const uuidB = uuidv4();
    const invalidPayload = {
      customer_id: userId,
      branch_id: branchId,
      // payment_method falta intencionalmente para fallar validación de Zod
      items: [{ product_id: productId, quantity: 1, unit_price: 200 }]
    };

    // Primera petición falla por Zod ValidationError
    const res1 = await request(app)
      .post('/api/sales')
      .set({ ...authHeaders, 'x-branch-id': branchId, 'x-shift-id': shiftId, 'x-idempotency-key': uuidB })
      .send(invalidPayload);

    expect(res1.status).toBe(400);

    // Esperar un poquito para asegurar que el evento res.on('finish') limpió el Redis
    await new Promise(r => setTimeout(r, 50));

    // Segunda petición corregida con MISMO UUIDB debe procesarse (no dar 409)
    const validPayload = { ...invalidPayload, payment_method: 'Efectivo' };
    const res2 = await request(app)
      .post('/api/sales')
      .set({ ...authHeaders, 'x-branch-id': branchId, 'x-shift-id': shiftId, 'x-idempotency-key': uuidB })
      .send(validPayload);

    expect(res2.status).toBe(201);
    expect(res2.body.success).toBe(true);
  });

  it('Caso C — Dos requests simultáneos (el segundo recibe 409)', async () => {
    const uuidC = uuidv4();
    const payload = {
      customer_id: userId,
      payment_method: 'Tarjeta',
      branch_id: branchId,
      items: [{ product_id: productId, quantity: 1, unit_price: 200 }]
    };

    // Lanzamos ambas peticiones sin await, simulando concurrencia
    const p1 = request(app)
      .post('/api/sales')
      .set({ ...authHeaders, 'x-branch-id': branchId, 'x-shift-id': shiftId, 'x-idempotency-key': uuidC })
      .send(payload);

    const p2 = request(app)
      .post('/api/sales')
      .set({ ...authHeaders, 'x-branch-id': branchId, 'x-shift-id': shiftId, 'x-idempotency-key': uuidC })
      .send(payload);

    const [res1, res2] = await Promise.all([p1, p2]);

    // Uno debe ser 201 (el que agarró el lock primero)
    // El otro debe ser 409 (el que llegó mientras estaba PROCESSING)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('Caso D — Error de negocio limpia el cerrojo (Stock insuficiente)', async () => {
    const uuidD = uuidv4();
    // Payload con stock insuficiente (pedimos 50, hay 10)
    const failPayload = {
      customer_id: userId,
      payment_method: 'Efectivo',
      branch_id: branchId,
      items: [{ product_id: productId, quantity: 50, unit_price: 200 }]
    };

    // Primera petición falla por stock
    const res1 = await request(app)
      .post('/api/sales')
      .set({ ...authHeaders, 'x-branch-id': branchId, 'x-shift-id': shiftId, 'x-idempotency-key': uuidD })
      .send(failPayload);

    expect(res1.status).toBe(400);
    expect(res1.body.message).toContain('Stock insuficiente');

    await new Promise(r => setTimeout(r, 50));

    // Segunda petición corregida con cantidad = 2
    const validPayload = { ...failPayload };
    validPayload.items[0].quantity = 2;

    const res2 = await request(app)
      .post('/api/sales')
      .set({ ...authHeaders, 'x-branch-id': branchId, 'x-shift-id': shiftId, 'x-idempotency-key': uuidD })
      .send(validPayload);

    expect(res2.status).toBe(201);
    expect(res2.body.success).toBe(true);
  });
});
