import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../server.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Branch } from '../models/Branch.js';
import { Inventory } from '../models/Inventory.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Purchase } from '../models/Purchase.js';
import { StockMovement } from '../models/StockMovement.js';
import bcryptjs from 'bcryptjs';
import { getAuthHeadersForUser } from './helpers/auth.js';

// Mock mails
vi.mock('../mailtrap/emails.js', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

// Mock Redis COMPLETO
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    incr: vi.fn(async () => 1),
  },
  getOrSetCache:    vi.fn(async (_key, fn) => ({ data: await fn(), fromCache: false })),
  invalidateCache:  vi.fn(async () => {}),
  bumpCacheVersion: vi.fn(async () => {}),
  getCacheVersion:  vi.fn(async () => 0),
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
  await new Promise((r) => setTimeout(r, 2000));
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) {
    await mongoReplSet.stop();
  }
});

afterEach(async () => {
  await Sale.deleteMany({});
  await SaleDetail.deleteMany({});
  await Purchase.deleteMany({});
  await StockMovement.deleteMany({});
  await Inventory.deleteMany({});
  await Product.deleteMany({});
  await Category.deleteMany({});
  await Branch.deleteMany({});
  vi.clearAllMocks();
});

describe('Casos de Borde Críticos y Seguridad', () => {
  let authHeaders;
  let userId;
  let categoryId;
  let productId;
  let activeBranchId;
  let inactiveBranchId;

  beforeEach(async () => {
    const testEmail = `edgeuser${Date.now()}@example.com`;
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const user = await User.create({
      email: testEmail,
      password: hashedPassword,
      name: 'Edge Tester',
      role: 'admin'
    });
    userId = user._id.toString();

    const cat = await Category.create({ name: 'Edge Category', user: userId });
    categoryId = cat._id.toString();

    // Crear sucursales (una activa y otra inactiva)
    const activeBranch = await Branch.create({
      name: 'Sucursal Activa',
      address: 'Calle Falsa 123',
      owner_id: userId,
      is_active: true
    });
    activeBranchId = activeBranch._id.toString();

    const inactiveBranch = await Branch.create({
      name: 'Sucursal Inactiva',
      address: 'Calle Fantasma 999',
      owner_id: userId,
      is_active: false
    });
    inactiveBranchId = inactiveBranch._id.toString();

    // Crear producto base
    const product = await Product.create({
      name: 'Producto Edge',
      price: 100,
      unit_type: 'unidad',
      category: categoryId,
      user: userId
    });
    productId = product._id.toString();

    // Login
    authHeaders = getAuthHeadersForUser(user._id, user.role);
  });

  // ─── 1. TEST DE CONCURRENCIA (ATOMICIDAD REAL) ──────────────────────────────────
  describe('Condiciones de Carrera (Concurrencia de Stock)', () => {
    it('debe prevenir stock negativo al ejecutar peticiones de venta simultáneas', async () => {
      // Stock inicial = 5
      await Inventory.create({ owner_id: userId, 
        product_id: productId,
        branch_id: activeBranchId,
        quantity: 5
      });

      // Crear 3 peticiones concurrentes de 2 unidades cada una (total solicitado = 6, stock = 5)
      const salePayload = {
        payment_method: 'Efectivo',
        branch_id: activeBranchId,
        items: [{ product_id: productId, quantity: 2, unit_price: 100 }]
      };

      // Ejecutar simultáneamente
      const requests = [
        request(app).post('/api/sales').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send(salePayload),
        request(app).post('/api/sales').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send(salePayload),
        request(app).post('/api/sales').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send(salePayload)
      ];

      const responses = await Promise.all(requests);

      const successCount = responses.filter(r => r.status === 201).length;
      const failureCount = responses.filter(r => r.status >= 400).length;

      // Al menos 1 venta debe ser exitosa y al menos 1 debe fallar (por stock o write conflict)
      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(failureCount).toBeGreaterThanOrEqual(1);

      // El stock final en Inventory debe ser exactamente (5 - successCount * 2) y >= 0
      const branchInventory = await Inventory.findOne({
        product_id: productId,
        branch_id: activeBranchId
      });

      expect(branchInventory.quantity).toBe(5 - successCount * 2);
      expect(branchInventory.quantity).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── 2. TEST DE SOFT-DELETE BYPASS PREVENTION ─────────────────────────────────
  describe('Prevención de operaciones sobre Sucursales Inactivas (Soft-Delete)', () => {
    it('debe fallar al intentar registrar una VENTA en una sucursal inactiva', async () => {
      // Asignar stock en la sucursal inactiva por si acaso
      await Inventory.create({ owner_id: userId, 
        product_id: productId,
        branch_id: inactiveBranchId,
        quantity: 10
      });

      const response = await request(app)
        .post('/api/sales')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          payment_method: 'Efectivo',
          branch_id: inactiveBranchId,
          items: [{ product_id: productId, quantity: 1, unit_price: 100 }]
        });

      expect(response.status).toBe(500); // El middleware/servicio aborta y lanza error
      expect(response.body.message).toContain('inactiva');
    });

    it('debe fallar al intentar registrar una COMPRA en una sucursal inactiva', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          supplier: 'Proveedor Fantasma',
          branch_id: inactiveBranchId,
          items: [{ product_id: productId, quantity: 5, unit_cost: 80 }]
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('inactiva');
    });

    it('debe fallar al intentar registrar un AJUSTE en una sucursal inactiva', async () => {
      const response = await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          product_id: productId,
          branch_id: inactiveBranchId,
          new_quantity: 50,
          reason: 'correction'
        });

      expect(response.status).toBe(400); // El controlador de ajustes devuelve 400 en errores de regla de negocio
      expect(response.body.message).toContain('inactiva');
    });
  });

  // ─── 3. TEST DE INTEGRIDAD DEL VIRTUAL totalStock ──────────────────────────────
  describe('Integridad del virtual totalStock de Productos', () => {
    it('debe calcular correctamente el stock consolidado sumando las sucursales pobladas', async () => {
      // Stock en sucursal activa = 15
      await Inventory.create({ owner_id: userId, 
        product_id: productId,
        branch_id: activeBranchId,
        quantity: 15
      });

      // Creamos una segunda sucursal activa para este inquilino
      const anotherBranch = await Branch.create({
        name: 'Sucursal Secundaria',
        address: 'Calle Secundaria 456',
        owner_id: userId,
        is_active: true
      });

      // Stock en sucursal secundaria = 25
      await Inventory.create({ owner_id: userId, 
        product_id: productId,
        branch_id: anotherBranch._id,
        quantity: 25
      });

      // Buscar el producto con populate('branchInventories')
      const product = await Product.findById(productId).populate('branchInventories');

      // totalStock debe ser exactamente 40 (15 + 25)
      expect(product.totalStock).toBe(40);
    });

    it('debe retornar 0 si las sucursales no están pobladas en la consulta de Mongoose', async () => {
      // Stock en sucursal activa = 15
      await Inventory.create({ owner_id: userId, 
        product_id: productId,
        branch_id: activeBranchId,
        quantity: 15
      });

      // Buscar el producto SIN populate
      const product = await Product.findById(productId);

      // totalStock debe retornar 0 (para no lanzar error ni falsear datos indefinidos)
      expect(product.totalStock).toBe(0);
    });
  });
});
