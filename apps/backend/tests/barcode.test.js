import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import bcryptjs from 'bcryptjs';
import { getAuthHeadersForUser } from './helpers/auth.js';

vi.mock('../mailtrap/emails.js', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

// Mock Redis COMPLETO: cubre tanto lib/redis.js como cache.middleware.js
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null),   // MISS de caché → pasa al controlador
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

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  await Product.deleteMany({});
  vi.clearAllMocks();
});

describe('Barcode Feature — Integration Tests', () => {
  let authHeaders;
  let categoryId;
  let userId;

  beforeAll(async () => {
    // 1. Crear usuario admin directamente en BD
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const user = await User.create({
      email: `barcode_tester_${Date.now()}@example.com`,
      password: hashedPassword,
      name: 'Barcode Admin',
      role: 'admin',
    });
    userId = user._id.toString();

    // 2. Generar JWT directamente (stateless, sin login HTTP)
    authHeaders = getAuthHeadersForUser(user._id, user.role);

    // 3. Crear categoría base en BD
    const category = new Category({ name: 'Barcode Category', user: userId });
    await category.save();
    categoryId = category._id.toString();
  });

  // ─────────────────────────────────────────────────────────────────────
  // POST /api/products — campo barcode al crear
  // ─────────────────────────────────────────────────────────────────────
  describe('POST /api/products — con barcode', () => {
    it('debe crear un producto con barcode correctamente', async () => {
      const response = await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({
          name: 'Coca Cola 600ml',
          price: 25,
          category: categoryId,
          barcode: '7501055300846',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.product.barcode).toBe('7501055300846');
    });

    it('debe crear un producto SIN barcode (campo opcional)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({
          name: 'Producto Sin Barcode',
          price: 10,
          category: categoryId,
          // Sin campo barcode
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // Sin barcode el campo no existe en el documento (undefined, no null)
      expect(response.body.product.barcode).toBeUndefined();
    });

    it('debe rechazar barcode duplicado para el mismo usuario (400)', async () => {
      // Creamos el primero
      await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Producto A', price: 10, category: categoryId, barcode: '1234567890123' });

      // Intentamos crear otro con el mismo barcode
      const response = await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Producto B', price: 20, category: categoryId, barcode: '1234567890123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Producto A');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // GET /api/products/barcode/:code — buscar por código de barras
  // ─────────────────────────────────────────────────────────────────────
  describe('GET /api/products/barcode/:code', () => {
    it('debe encontrar un producto por su código de barras', async () => {
      // Crear producto
      await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Pepsi 500ml', price: 20, category: categoryId, barcode: '7501000120285' });

      // Buscar por barcode
      const response = await request(app)
        .get('/api/products/barcode/7501000120285')
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.product.name).toBe('Pepsi 500ml');
      expect(response.body.product.barcode).toBe('7501000120285');
      expect(response.body.product.category.name).toBe('Barcode Category'); // populated
      expect(response.body).toHaveProperty('fromCache'); // campo fromCache siempre presente
    });

    it('debe retornar 404 para un código de barras inexistente', async () => {
      const response = await request(app)
        .get('/api/products/barcode/0000000000000')
        .set(authHeaders);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No se encontró un producto con ese código de barras');
    });

    it('debe retornar 401 si no está autenticado', async () => {
      const response = await request(app)
        .get('/api/products/barcode/7501055300846');
      // Sin cookie

      expect(response.status).toBe(401);
    });

    it('un usuario NO debe ver el producto con barcode de OTRO usuario', async () => {
      // Crear segundo usuario
      const hashedPwd = await bcryptjs.hash('pass123', 10);
      const otherUser = await User.create({
        email: `other_${Date.now()}@example.com`,
        password: hashedPwd,
        name: 'Other User',
        role: 'admin',
      });
      const otherHeaders = getAuthHeadersForUser(otherUser._id, otherUser.role);

      // El usuario original crea producto con barcode
      await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Producto Exclusivo', price: 99, category: categoryId, barcode: '9999999999999' });

      // El otro usuario intenta buscar ese barcode → debe ser 404
      const response = await request(app)
        .get('/api/products/barcode/9999999999999')
        .set(otherHeaders);

      expect(response.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // PUT /api/products/:id — actualizar barcode
  // ─────────────────────────────────────────────────────────────────────
  describe('PUT /api/products/:id — actualizar barcode', () => {
    it('debe asignar un barcode nuevo a un producto existente', async () => {
      const createRes = await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Producto Sin Código', price: 15, category: categoryId });
      const productId = createRes.body.product._id;

      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set(authHeaders)
        .send({ barcode: '1111111111111' });

      expect(response.status).toBe(200);
      expect(response.body.product.barcode).toBe('1111111111111');
    });

    it('debe eliminar un barcode enviando null', async () => {
      const createRes = await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Producto Con Código', price: 30, category: categoryId, barcode: '2222222222222' });
      const productId = createRes.body.product._id;

      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set(authHeaders)
        .send({ barcode: null });

      expect(response.status).toBe(200);
      expect(response.body.product.barcode).toBeNull();
    });

    it('debe rechazar update si el barcode ya pertenece a OTRO producto del mismo usuario', async () => {
      // Creamos dos productos
      await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Producto X', price: 10, category: categoryId, barcode: '3333333333333' });

      const createResY = await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Producto Y', price: 20, category: categoryId });
      const productYId = createResY.body.product._id;

      // Intentamos asignar el barcode de X a Y
      const response = await request(app)
        .put(`/api/products/${productYId}`)
        .set(authHeaders)
        .send({ barcode: '3333333333333' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Producto X');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // DELETE /api/products/:id — el barcode no queda huérfano tras eliminar
  // ─────────────────────────────────────────────────────────────────────
  describe('DELETE /api/products/:id — limpieza de barcode', () => {
    it('tras eliminar un producto, su barcode debe poder reutilizarse en uno nuevo', async () => {
      // Crear y eliminar
      const createRes = await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Producto Temporal', price: 5, category: categoryId, barcode: '4444444444444' });
      const productId = createRes.body.product._id;

      await request(app)
        .delete(`/api/products/${productId}`)
        .set(authHeaders);

      // Crear un producto nuevo con el mismo barcode → debe funcionar
      const newResponse = await request(app)
        .post('/api/products')
        .set(authHeaders)
        .send({ name: 'Nuevo Producto', price: 10, category: categoryId, barcode: '4444444444444' });

      expect(newResponse.status).toBe(201);
      expect(newResponse.body.product.barcode).toBe('4444444444444');
    });
  });
});
