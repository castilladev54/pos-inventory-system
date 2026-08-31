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
  // Limpiamos solo las colecciones que alteramos en cada prueba
  // El usuario base permanece intacto para no sobrecargar el límite de peticiones de login.
  await Category.deleteMany({});
  await Product.deleteMany({});
  vi.clearAllMocks();
});

describe('Category Controllers Integration', () => {
  let authHeaders;
  let userId;
  
  beforeAll(async () => {
    const testEmail = `categorytest${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

    // 1. Creamos un usuario de prueba directamente en BD (Se ejecuta UNA SOLA VEZ para todas las pruebas)
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const user = await User.create({
      email: testEmail,
      password: hashedPassword,
      name: 'Category Tester',
      role: 'admin'
    });
    userId = user._id.toString();
    
    // 2. Generar JWT directamente (stateless, sin login HTTP)
    authHeaders = getAuthHeadersForUser(user._id, user.role);
  });

  describe('POST /api/categories', () => {
    it('should create a new category successfully', async () => {
      const response = await request(app)
        .post('/api/categories')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({
          name: 'Electronics',
          description: 'Electronic devices'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.category.name).toBe('Electronics');
      expect(response.body.category.user).toBe(userId);
    });

    it('should fail if category name already exists for this user', async () => {
      // Creamos la categoría inicial
      await request(app)
        .post('/api/categories')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({ name: 'Drinks' });
      
      // Intentamos crear otra con el mismo nombre y usuario
      const response = await request(app)
        .post('/api/categories')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({ name: 'Drinks' });

      expect(response.status).toBe(400); 
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('La categoría ya existe');
    });

    it('should return validation error if required fields (name) are missing', async () => {
      const response = await request(app)
        .post('/api/categories')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({ description: 'I have no name' });

      expect(response.status).toBe(400); // 400 Bad Request provisto por the Zod validate middleware
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/categories', () => {
    it('should return empty list if user has no categories', async () => {
      const response = await request(app)
        .get('/api/categories')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.categories).toHaveLength(0);
    });

    it('should return all categories for the logged in user', async () => {
      await request(app).post('/api/categories').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send({ name: 'Cat 1' });
      await request(app).post('/api/categories').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send({ name: 'Cat 2' });

      const response = await request(app)
        .get('/api/categories')
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.categories).toHaveLength(2);
      expect(response.body.categories.map(c => c.name)).toContain('Cat 1');
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should fetch a specific category by its ID', async () => {
      const createRes = await request(app).post('/api/categories').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send({ name: 'Search Me' });
      const catId = createRes.body.category._id;

      const response = await request(app)
        .get(`/api/categories/${catId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.category.name).toBe('Search Me');
    });

    it('should return 404 for non-existent category ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/categories/${fakeId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Categoría no encontrada');
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('should update a category name and description successfully', async () => {
      const createRes = await request(app).post('/api/categories').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send({ name: 'Old Name' });
      const catId = createRes.body.category._id;

      const response = await request(app)
        .put(`/api/categories/${catId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() })
        .send({ name: 'New Name', description: 'Updated Content' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.category.name).toBe('New Name');
      expect(response.body.category.description).toBe('Updated Content');
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should delete a category with no associated products successfully', async () => {
      const createRes = await request(app).post('/api/categories').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send({ name: 'Delete Me' });
      const catId = createRes.body.category._id;

      const response = await request(app)
        .delete(`/api/categories/${catId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Categoría eliminada correctamente');
    });

    it('should return 400 if trying to delete a category that has associated products', async () => {
      // 1. Crear categoría
      const createRes = await request(app).post('/api/categories').set({ ...authHeaders, 'x-branch-id': branchId.toString() }).send({ name: 'In Use Category' });
      const catId = createRes.body.category._id;

      // 2. Insertar directamente en la BD un producto que apunte a esa categoría
      const product = new Product({
        name: 'Associated Product',
        price: 15,
        unit_type: 'unidad',
        category: catId,
        user: userId
      });
      await product.save();

      // 3. Intentar eliminar la categoría (Debería fallar según la regla en controller)
      const response = await request(app)
        .delete(`/api/categories/${catId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('tiene productos asociados');
    });

    it('should return 404 for deleting non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/categories/${fakeId}`)
        .set({ ...authHeaders, 'x-branch-id': branchId.toString() });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
