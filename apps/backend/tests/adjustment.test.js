import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../server.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { StockMovement } from '../models/StockMovement.js';
import { Branch } from '../models/Branch.js';
import { Inventory } from '../models/Inventory.js';
import bcryptjs from 'bcryptjs';
import { getAuthHeaders } from './helpers/auth.js';

// Mock mails
vi.mock('../mailtrap/emails.js', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

// Redis ya está mockeado globalmente en tests/setup.js

let mongoReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }]
  });
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
  await Product.deleteMany({});
  await StockMovement.deleteMany({});
  await Inventory.deleteMany({});
  vi.clearAllMocks();
});

describe('Inventory Adjustment Feature', () => {
  let authHeaders;
  let userId;
  let categoryId;
  let branchId;

  beforeAll(async () => {
    const testEmail = `adjusttest${Date.now()}@example.com`;
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const user = await User.create({
      email: testEmail,
      password: hashedPassword,
      name: 'Adjust Tester',
      role: 'admin'
    });
    userId = user._id.toString();

    const cat = await Category.create({ name: 'Test Category', user: userId });
    categoryId = cat._id.toString();

    const branch = await Branch.create({
      name: 'Sucursal Test Ajustes',
      address: 'Calle Test 1',
      owner_id: userId,
      is_active: true
    });
    branchId = branch._id.toString();

    authHeaders = await getAuthHeaders(testEmail, 'password123');
  });

  describe('POST /api/adjustments', () => {
    it('debe crear un ajuste y sumar stock incremental (carga inicial)', async () => {
      // 1. Crear producto (sin stock inicial — ahora vive en Inventory)
      const product = await Product.create({
        name: 'Agua Min',
        price: 15,
        unit_type: 'unidad',
        category: categoryId,
        user: userId
      });

      // 2. Ejecutar ajuste incremental: quantity = +50 (delta desde 0)
      const response = await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          product_id: product._id.toString(),
          branch_id: branchId,
          quantity: 50,
          reason: 'INITIAL_INVENTORY',
          notes: 'Conteo de caja inicial'
        });

      // DEBUG: ver qué error devuelve el servidor
      if (response.status !== 201) {
        console.error('DEBUG RESPONSE:', response.status, JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Number(response.body.data.new_quantity)).toBe(50);
      expect(Number(response.body.data.previous_quantity)).toBe(0);

      // Verificar que el stock se refleje en Inventory
      const branchInv = await Inventory.findOne({ product_id: product._id, branch_id: branchId });
      expect(Number(branchInv.quantity.toString())).toBe(50);
    });

    it('debe rechazar un ajuste con quantity = 0 (Zod validation)', async () => {
      const product = await Product.create({
        name: 'Gorra',
        price: 100,
        unit_type: 'unidad',
        category: categoryId,
        user: userId
      });

      const response = await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          product_id: product._id.toString(),
          branch_id: branchId,
          quantity: 0,
          reason: 'CORRECTION'
        });

      expect(response.status).toBe(400);
    });

    it('debe rechazar un reason inválido (Zod enum validation)', async () => {
      const product = await Product.create({
        name: 'Vaso',
        price: 5,
        unit_type: 'unidad',
        category: categoryId,
        user: userId
      });

      const response = await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          product_id: product._id.toString(),
          branch_id: branchId,
          quantity: -3,
          reason: 'broken' // Reason inválido — Zod lo rechazará con 400
        });

      expect(response.status).toBe(400);
    });

    it('debe registrar restas de stock correctamente (DAMAGE)', async () => {
      const product = await Product.create({
        name: 'Vaso Dañado',
        price: 5,
        unit_type: 'unidad',
        category: categoryId,
        user: userId
      });

      // Stock inicial en Inventory = 10
      await Inventory.create({
        product_id: product._id,
        branch_id: branchId,
        owner_id: userId,
        quantity: 10
      });

      // Ajuste incremental: quantity = -3 (resta 3 unidades)
      const response = await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          product_id: product._id.toString(),
          branch_id: branchId,
          quantity: -3,
          reason: 'DAMAGE'
        });

      expect(response.status).toBe(201);
      expect(Number(response.body.data.previous_quantity)).toBe(10);
      expect(Number(response.body.data.new_quantity)).toBe(7);

      // Verificar stock actualizado en Inventory
      const branchInv = await Inventory.findOne({ product_id: product._id, branch_id: branchId });
      expect(Number(branchInv.quantity.toString())).toBe(7);
    });

    it('debe rechazar un product_id que no existe en el catálogo (integridad referencial)', async () => {
      const fakeProductId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          product_id: fakeProductId,
          branch_id: branchId,
          quantity: 10,
          reason: 'INITIAL_INVENTORY'
        });

      expect(response.status).toBe(404);
    });

    it('debe prevenir ajustes duplicados con Idempotency-Key (409 Conflict)', async () => {
      const product = await Product.create({
        name: 'Producto Idempotente',
        price: 20,
        unit_type: 'unidad',
        category: categoryId,
        user: userId
      });

      const idempotencyKey = `test-idem-${Date.now()}`;
      const payload = {
        product_id: product._id.toString(),
        branch_id: branchId,
        quantity: 5,
        reason: 'INITIAL_INVENTORY'
      };

      // Primera petición → 201
      const first = await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString(), 'idempotency-key': idempotencyKey })
        .send(payload);

      expect(first.status).toBe(201);

      // Segunda petición con la misma key → 409
      const second = await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString(), 'idempotency-key': idempotencyKey })
        .send(payload);

      expect(second.status).toBe(409);

      // Verificar que el stock solo se incrementó una vez
      const branchInv = await Inventory.findOne({ product_id: product._id, branch_id: branchId });
      expect(Number(branchInv.quantity.toString())).toBe(5);
    });
  });

  describe('GET /api/adjustments', () => {
    it('debe obtener el historial de ajustes', async () => {
      const product = await Product.create({
        name: 'Prueba Get',
        price: 50,
        unit_type: 'unidad',
        category: categoryId,
        user: userId
      });

      await request(app)
        .post('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          product_id: product._id.toString(),
          branch_id: branchId,
          quantity: 100,
          reason: 'INITIAL_INVENTORY'
        });

      const response = await request(app)
        .get('/api/adjustments')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.adjustments).toHaveLength(1);
      expect(response.body.adjustments[0].reason).toContain('INITIAL_INVENTORY');
      expect(response.body.adjustments[0].product_id.name).toBe('Prueba Get');
    });
  });
});
