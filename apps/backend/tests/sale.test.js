import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server'; // ReplSet para soportar transacciones ACID
import app from '../server.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Branch } from '../models/Branch.ts';
import { Inventory } from '../models/Inventory.ts';
import { StockMovement } from '../models/StockMovement.ts';
import { CashShift } from '../models/CashShift.model.ts';
import bcryptjs from 'bcryptjs';
import { createAdminUser, createBranch } from './helpers/testUtils.js';
import { getAuthHeadersForUser } from './helpers/auth.js';
import crypto from 'crypto';

// Mockeamos el envío de emails para evitar enviar correos reales
vi.mock('../mailtrap/emails.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    incr: vi.fn(async () => 1),
    exists: vi.fn(async () => 1),
    pipeline: vi.fn(() => ({
      sismember: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 0]]),
    })),
  },
  getOrSetCache: vi.fn(async (_key, fn) => ({ data: await fn(), fromCache: false })),
  invalidateCache: vi.fn(async () => { }),
  bumpCacheVersion: vi.fn(async () => { }),
  bumpBranchCacheVersion: vi.fn(async () => { }),
  getCacheVersion: vi.fn(async () => 0),
  buildPaginatedKey: vi.fn((_p, _v, _pg, _l, uid) => `mock:${uid}`),
}));

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
  await CashShift.deleteMany({});
  await Sale.deleteMany({});
  await SaleDetail.deleteMany({});
  await Product.deleteMany({});
  await Inventory.deleteMany({});
  await StockMovement.deleteMany({});
  vi.clearAllMocks();
});

describe('Sale Controllers Integration', () => {
  let authHeaders;
  let userId;
  let categoryId;
  let productId;
  let branchId;

  beforeAll(async () => {
    const adminRes = await createAdminUser('seller');
    userId = adminRes.userId;
    authHeaders = adminRes.authHeaders;

    const category = new Category({ name: 'Tech Store', user: userId });
    await category.save();
    categoryId = category._id.toString();

    // Crear sucursal de prueba
    const branchRes = await createBranch(userId, {
      name: 'Sucursal de Pruebas Ventas',
      address: 'Calle de las Ventas 77'
    });
    branchId = branchRes.branchId.toString();
  });

  beforeEach(async () => {
    const product = new Product({
      name: 'Queso Mozzarella',
      price: 1000,
      unit_type: 'kg',
      category: categoryId,
      user: userId
    });
    await product.save();
    productId = product._id.toString();

    // Inyectar el stock en la sucursal de prueba
    await Inventory.create({
      owner_id: userId,
      product_id: product._id,
      branch_id: branchId,
      quantity: 20,
      min_quantity: 0
    });
  });

  const openCashShift = async () => {
    const response = await request(app)
      .post('/api/shifts/open')
      .set({
        ...authHeaders,
        'x-branch-id': branchId.toString(),
      })
      .send({
        opening_balance: '1000.00',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('OPEN');

    return response;
  };

  describe('POST /api/sales', () => {
    it('should create a sale with FRACTIONAL quantities (kg support) and automatically DECREMENT product stock', async () => {
      await openCashShift();

      // Zod Validator exige obligatoriamente incluir 'customer_id' en el body.
      const payload = {
        customer_id: userId,
        payment_method: 'Tarjeta',
        branch_id: branchId,
        items: [
          {
            product_id: productId.toString(),
            quantity: '5.5', // 5 kilos y medio
            unit_price: '1500' // total_amount del comprobante debería autocalcularse en 8250 (1500 * 5.5)
          }
        ]
      };

      const response = await request(app)
        .post('/api/sales')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .set('x-idempotency-key', crypto.randomUUID())
        .send(payload);

      console.log(
        'FRACTIONAL SALE RESPONSE:',
        JSON.stringify(response.body, null, 2)
      );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.sale.total_amount).toBe('8250'); // 1500 * 5.5 = 8250
      expect(response.body.sale.payment_method).toBe('Tarjeta');
      expect(response.body.sale.status).toBe('completed');

      const saleId = response.body.sale._id;

      // 1. Verificamos la creación detallada en la colección SaleDetail
      const details = await SaleDetail.find({ sale_id: saleId });
      expect(details).toHaveLength(1);
      expect(details[0].product_id.toString()).toBe(productId);
      expect(details[0].quantity.toString()).toBe('5.5');

      // 2. STOCK DECREMENTADO AUTOMÁTICAMENTE: 
      // Teníamos 20 de inventario, acabamos de vender 5.5 -> Quedan 14.5 en Inventory
      const updatedInventory = await Inventory.findOne({ product_id: productId, branch_id: branchId });
      expect(updatedInventory.quantity.toString()).toBe('14.5');

      // 3. STOCK MOVEMENT CREADO
      const movements = await StockMovement.find({ product_id: productId, branch_id: branchId });
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('SALE');
      expect(movements[0].quantity_change.toString()).toBe('-5.5');
    });

    it('should return 400 validation error if missing required Zod fields (e.g., payment_method)', async () => {
      await openCashShift();

      const payload = {
        branch_id: branchId,
        // payment_method es intencionalmente omitido para que Zod rechace el request
        items: [{ product_id: productId.toString(), quantity: '1', unit_price: '1' }]
      };

      const response = await request(app)
        .post('/api/sales')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .set('x-idempotency-key', crypto.randomUUID())
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should return 400 if trying to sell MORE stock than what is currently available', async () => {
      await openCashShift();

      const payload = {
        customer_id: userId,
        payment_method: 'Tarjeta',
        branch_id: branchId,
        items: [{ product_id: productId.toString(), quantity: '50.2', unit_price: '1000' }] // stock original es 20. Trato de vender 50.2
      };

      const response = await request(app)
        .post('/api/sales')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .set('x-idempotency-key', crypto.randomUUID())
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Stock insuficiente');

      // El stock debió quedarse en 20 intacto en Inventory
      const updatedInventory = await Inventory.findOne({ product_id: productId, branch_id: branchId });
      expect(updatedInventory.quantity.toString()).toBe('20');
    });

    it('should return 404 if product inside the items array does not exist', async () => {
      await openCashShift();

      const fakeProductId = new mongoose.Types.ObjectId().toString();
      const payload = {
        customer_id: userId,
        payment_method: 'Tarjeta',
        branch_id: branchId,
        items: [{ product_id: fakeProductId, quantity: '1', unit_price: '10' }]
      };

      const response = await request(app)
        .post('/api/sales')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .set('x-idempotency-key', crypto.randomUUID())
        .send(payload);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('no encontrado');
    });
  });

  describe('GET /api/sales', () => {
    it('should list all available sales for the specific user', async () => {
      await openCashShift();

      await request(app).post('/api/sales').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).set('x-idempotency-key', crypto.randomUUID()).send({
        customer_id: userId,
        payment_method: 'Efectivo',
        branch_id: branchId,
        items: [{ product_id: productId.toString(), quantity: '2', unit_price: '50' }]
      });

      const response = await request(app).get('/api/sales').set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.sales).toHaveLength(1);
      expect(response.body.sales[0].payment_method).toBe('Efectivo');
      expect(response.body.sales[0].total_amount).toBe('100');
    });
  });

  describe('GET /api/sales/:id', () => {
    it('should fetch a single specific sale aggregating its items (details array)', async () => {


      await openCashShift();

      const createRes = await request(app)
        .post('/api/sales')
        .set({
          ...authHeaders,
          'x-branch-id': branchId.toString(),
        })
        .set('x-idempotency-key', crypto.randomUUID())
        .send({
          customer_id: userId,
          payment_method: 'Divisas',
          branch_id: branchId,
          items: [
            {
              product_id: productId.toString(),
              quantity: '3.5',
              unit_price: '100',
            },
          ],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.sale).toBeDefined();

      const saleId = createRes.body.sale._id;

      // 2. Levantar la data individual
      const response = await request(app).get(`/api/sales/${saleId}`).set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.sale._id).toBe(saleId);
      expect(response.body.sale.payment_method).toBe('Divisas');

      // 3. El Backend inyecta el listado de Detalle en un array en la raíz del json usando `items:`
      expect(response.body.sale.items).toBeDefined();
      expect(response.body.sale.items).toHaveLength(1);
      expect(response.body.sale.items[0].product_id.name).toBe('Queso Mozzarella'); // populado automáticamente
    });

    it('should return 404 for grabbing a non-existent sale ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).get(`/api/sales/${fakeId}`).set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(404);
    });
  });
});
