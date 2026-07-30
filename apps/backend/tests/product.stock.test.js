/**
 * @file product.stock.test.js
 * @description Tests de integración para la Ruta B: corrección de stock desde PUT /api/products/:id.
 *
 * Requiere MongoMemoryReplSet porque el controlador usa Transacciones ACID
 * al llamar a createAdjustmentProcess() cuando new_stock está presente.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../server.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { InventoryAdjustment } from '../models/InventoryAdjustment.js';
import { Branch } from '../models/Branch.js';
import { BranchInventory } from '../models/BranchInventory.js';
import bcryptjs from 'bcryptjs';
import { getAuthHeadersForUser } from './helpers/auth.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────
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
  },
  getOrSetCache:    vi.fn(async (_key, fn) => ({ data: await fn(), fromCache: false })),
  invalidateCache:  vi.fn(async () => {}),
  bumpCacheVersion: vi.fn(async () => {}),
  getCacheVersion:  vi.fn(async () => 0),
  buildPaginatedKey: vi.fn((_p, _v, _pg, _l, uid) => `mock:${uid}`),
}));

// ─── Infraestructura ─────────────────────────────────────────────────────────
let mongoReplSet;

beforeAll(async () => {
  // ReplSet obligatorio para las transacciones ACID de new_stock
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoReplSet.getUri();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongoose.connect(mongoUri);
  await new Promise((r) => setTimeout(r, 1500)); // esperar nodo PRIMARY
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) await mongoReplSet.stop();
});

afterEach(async () => {
  // Drop para evitar E11000 en el índice sparse de barcode entre tests
  await mongoose.connection.collection('products').drop().catch(() => {});
  await InventoryAdjustment.deleteMany({});
  await BranchInventory.deleteMany({});
  vi.clearAllMocks();
});

// ─── Fixtures base ────────────────────────────────────────────────────────────
describe('PUT /api/products/:id — corrección de stock (Ruta B)', () => {
  let authHeaders;
  let userId;
  let categoryId;
  let branchId;

  beforeAll(async () => {
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const user = await User.create({
      email: `stock_correction_${Date.now()}@test.com`,
      password: hashedPassword,
      name: 'Stock Tester',
      role: 'admin',
    });
    userId = user._id.toString();

    authHeaders = getAuthHeadersForUser(user._id, user.role);

    const category = await Category.create({ name: 'Stock Test Cat', user: userId });
    categoryId = category._id.toString();

    // Crear sucursal de prueba
    const branch = await Branch.create({
      name: 'Sucursal Test Correcciones',
      address: 'Calle del Stock 10',
      owner_id: userId,
      is_active: true
    });
    branchId = branch._id.toString();
  });

  // Helper: crea un producto con stock inicial en BranchInventory
  const createProduct = async (stock = 10, name = 'Producto Base') => {
    const product = await Product.create({
      name,
      price: 100,
      unit_type: 'unidad',
      category: categoryId,
      user: userId,
      barcode: `BC-${Date.now()}-${Math.random()}`,
    });

    if (stock > 0) {
      await BranchInventory.create({
        product_id: product._id,
        branch_id: branchId,
        stock,
        min_stock: 0
      });
    }

    return product._id.toString();
  };

  // ─── CASO 1: Update sin new_stock ──────────────────────────────────────────
  it('📝 sin new_stock → actualiza metadata sin tocar stock ni crear ajuste', async () => {
    const productId = await createProduct(15, 'Original Name');

    const response = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeaders)
      .send({ name: 'Updated Name', price: 200 }); // sin new_stock

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.product.name).toBe('Updated Name');
    expect(response.body.product.price).toBe(200);
    expect(response.body.stockAdjusted).toBeUndefined(); // NO debe aparecer

    // Stock NO debe haber cambiado en la sucursal
    const branchInv = await BranchInventory.findOne({ product_id: productId, branch_id: branchId });
    expect(branchInv.stock).toBe(15);

    // Ningún ajuste creado
    const adjustments = await InventoryAdjustment.countDocuments();
    expect(adjustments).toBe(0);
  });

  // ─── CASO 2: Update CON new_stock + stock_reason válidos ───────────────────
  it('✅ con new_stock + stock_reason → actualiza metadata Y crea ajuste en BD', async () => {
    const productId = await createProduct(10, 'Ajuste Product');

    const response = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeaders)
      .send({
        name: 'Ajuste Product Updated',
        price: 150,
        new_stock: 25,
        stock_reason: 'correction',
        branch_id: branchId,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.stockAdjusted).toBe(true);
    expect(response.body.message).toContain('25'); // mensaje incluye el nuevo stock

    // Metadata actualizada
    expect(response.body.product.name).toBe('Ajuste Product Updated');
    expect(response.body.product.price).toBe(150);

    // Stock actualizado en BranchInventory
    const branchInv = await BranchInventory.findOne({ product_id: productId, branch_id: branchId });
    expect(branchInv.stock).toBe(25);

    // El ajuste fue creado en el Kárdex
    const adjustments = await InventoryAdjustment.find({ product_id: productId });
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].previous_stock).toBe(10);
    expect(adjustments[0].new_stock).toBe(25);
    expect(adjustments[0].difference).toBe(15);
    expect(adjustments[0].reason).toBe('correction');
  });

  // ─── CASO 3: new_stock sin stock_reason → Zod rechaza ─────────────────────
  it('🚫 new_stock sin stock_reason → 400 de validación Zod (refine)', async () => {
    const productId = await createProduct(10);

    const response = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeaders)
      .send({ new_stock: 20, branch_id: branchId }); // sin stock_reason

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors[0].message).toContain('stock_reason');

    // Sin mutaciones en la sucursal
    const branchInv = await BranchInventory.findOne({ product_id: productId, branch_id: branchId });
    expect(branchInv.stock).toBe(10); // intacto
    expect(await InventoryAdjustment.countDocuments()).toBe(0);
  });

  // ─── CASO 4: stock_reason sin new_stock → Zod rechaza ─────────────────────
  it('🚫 stock_reason sin new_stock → 400 de validación Zod (refine)', async () => {
    const productId = await createProduct(10);

    const response = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeaders)
      .send({ stock_reason: 'correction', branch_id: branchId }); // sin new_stock

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors[0].message).toContain('new_stock');
  });

  // ─── CASO 5: new_stock === stock actual → regla de negocio ─────────────────
  it('🚫 new_stock igual al stock actual → 400 de servicio de ajustes', async () => {
    const productId = await createProduct(10); // stock = 10

    const response = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeaders)
      .send({ new_stock: 10, stock_reason: 'correction', branch_id: branchId }); // mismo stock

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('igual al stock actual');

    // Sin ajuste huérfano
    expect(await InventoryAdjustment.countDocuments()).toBe(0);
  });

  // ─── CASO 6: El ajuste aparece en GET /api/adjustments (Kárdex) ────────────
  it('📋 el ajuste creado aparece en el historial del Kárdex', async () => {
    const productId = await createProduct(5, 'Kárdex Product');

    await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeaders)
      .send({ new_stock: 30, stock_reason: 'initial_count', branch_id: branchId });

    const kardexRes = await request(app)
      .get('/api/adjustments')
      .set(authHeaders);

    expect(kardexRes.status).toBe(200);
    expect(kardexRes.body.adjustments).toHaveLength(1);

    const adj = kardexRes.body.adjustments[0];
    expect(adj.reason).toBe('initial_count');
    expect(adj.previous_stock).toBe(5);
    expect(adj.new_stock).toBe(30);
    expect(adj.difference).toBe(25);
    expect(adj.product_id.name).toBe('Kárdex Product'); // populado
  });

  // ─── CASO 7: Ajuste negativo (merma) ───────────────────────────────────────
  it('✅ ajuste negativo (merma): product.stock baja correctamente', async () => {
    const productId = await createProduct(20);

    const response = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeaders)
      .send({ new_stock: 13, stock_reason: 'damaged', branch_id: branchId });

    expect(response.status).toBe(200);

    const branchInv = await BranchInventory.findOne({ product_id: productId, branch_id: branchId });
    expect(branchInv.stock).toBe(13);

    const adjustment = await InventoryAdjustment.findOne({ product_id: productId });
    expect(adjustment.difference).toBe(-7); // 13 - 20
    expect(adjustment.reason).toBe('damaged');
  });

  // ─── CASO 8: Producto inexistente con new_stock → 404, sin ajuste huérfano ─
  it('🚫 producto inexistente con new_stock → 404 y sin ajuste en BD', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const response = await request(app)
      .put(`/api/products/${fakeId}`)
      .set(authHeaders)
      .send({ new_stock: 50, stock_reason: 'correction', branch_id: branchId });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('no encontrado');

    // Ningún ajuste huérfano debe existir
    expect(await InventoryAdjustment.countDocuments()).toBe(0);
  });
});

