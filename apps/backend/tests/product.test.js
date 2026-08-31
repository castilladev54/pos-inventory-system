import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import bcryptjs from 'bcryptjs';
import { getAuthHeadersForUser } from './helpers/auth.js';

// Mocking external email delivery API to avoid sending real emails
vi.mock('../mailtrap/emails.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

// Mock Redis: evita llamadas HTTP reales a Upstash en CI/CD
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

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
}, 60000); // 60s timeout in case of downloading mongodb binaries

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  // Solo eliminamos la colección de productos para no borrar el usuario/categoría base
  await Product.deleteMany({});
  vi.clearAllMocks();
});

describe('Product Controllers Integration', () => {
  let authHeaders;
  let categoryId;
  let userId;
  let testEmail;
  
  beforeAll(async () => {
    testEmail = `user${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

    // 1. Creamos un usuario de prueba directamente en DB (pues signup ya no existe)
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const user = await User.create({
      email: testEmail,
      password: hashedPassword,
      name: 'Test Admin',
      role: 'admin'
    });
    userId = user._id.toString();

    // 2. Generar JWT directamente (stateless, sin login HTTP)
    authHeaders = getAuthHeadersForUser(user._id, user.role);

    // 3. Creamos una categoría directamente en la BD asociandolo a nuestro usuario
    const category = new Category({
      name: 'Test Category DB',
      description: 'Created from DB',
      user: userId
    });
    await category.save();
    categoryId = category._id.toString();
  });

  describe('POST /api/products', () => {
    it('should create a new product successfully with unit_type (kg support)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          name: 'Test Product',
          description: 'A great test product',
          price: 150,
          category: categoryId,
          unit_type: 'kg'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.product.name).toBe('Test Product');
      expect(response.body.product.price).toBe(150);
      // stock ya no vive en Product — migrado a Inventory
      expect(response.body.product.category).toBe(categoryId);
      expect(response.body.product.user).toBe(userId);
      expect(response.body.product.unit_type).toBe('kg');
    });

    it('should return 400 if category does not exist for this user', async () => {
      const fakeCategoryId = new mongoose.Types.ObjectId().toString(); // ID válido pero no existente
      const response = await request(app)
        .post('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          name: 'Test Product Fake Cat',
          price: 100,
          category: fakeCategoryId
        });

      expect(response.status).toBe(400); 
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('La categoría especificada no existe');
    });

    it('should return validation error if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          // Falta 'name' y 'price'
          category: categoryId
        });

      expect(response.status).toBe(400); // Bad Request proveniente de Zod o mongoose
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/products', () => {
    it('should return empty list if user has no products', async () => {
      const response = await request(app)
        .get('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.products).toHaveLength(0);
    });

    it('should return list of products for the logged in user with populated category', async () => {
      // Creamos un producto primero
      await request(app)
        .post('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          name: 'My Custom Product',
          price: 60,
          category: categoryId
        });

      const response = await request(app)
        .get('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toBe('My Custom Product');
      expect(response.body.products[0].category._id).toBe(categoryId);
      expect(response.body.products[0].category.name).toBe('Test Category DB'); // 'name' debe venir populated
    });
  });

  describe('GET /api/products/:id', () => {
    it('should fetch a specific product by its ID', async () => {
      // Creamos primero
      const createRes = await request(app)
        .post('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          name: 'Target Product',
          price: 75,
          category: categoryId
        });
      const productId = createRes.body.product._id;

      // Buscamos
      const response = await request(app)
        .get(`/api/products/${productId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.product.name).toBe('Target Product');
      expect(response.body.product.category.name).toBe('Test Category DB'); // Viene populated
    });

    it('should return 404 for non-existent product ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/products/${fakeId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Producto no encontrado');
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update a product successfully (ignoring stock, updating unit_type)', async () => {
      // Creamos
      const createRes = await request(app)
        .post('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          name: 'Old Name',
          price: 10,
          category: categoryId,
          unit_type: 'unidad'
        });
      const productId = createRes.body.product._id;

      // Actualizamos
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          name: 'New Name',
          price: 20,
          unit_type: 'litro',
          quantity: 99 // Este valor debería ignorarse según la lógica del controlador
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.product.name).toBe('New Name');
      expect(response.body.product.price).toBe(20);
      expect(response.body.product.unit_type).toBe('litro');
      // stock ya no vive en Product — migrado a Inventory
    });

    it('should return 400 if trying to update with non-existent category', async () => {
      const createRes = await request(app)
        .post('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({ name: 'Prod', price: 10, category: categoryId });
      const productId = createRes.body.product._id;

      const fakeCategoryId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({ category: fakeCategoryId });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('La categoría especificada no existe');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete a product successfully', async () => {
      // Creamos
      const createRes = await request(app)
        .post('/api/products')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          name: 'To be deleted',
          price: 100,
          category: categoryId
        });
      const productId = createRes.body.product._id;

      // Eliminamos
      const response = await request(app)
        .delete(`/api/products/${productId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Producto eliminado correctamente');

      // Verificamos que ya no exista
      const verifyRes = await request(app)
        .get(`/api/products/${productId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });
      expect(verifyRes.status).toBe(404);
    });

    it('should return 404 for deleting non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/products/${fakeId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Producto no encontrado');
    });
  });
});
