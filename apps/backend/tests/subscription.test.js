import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import { User } from '../models/User.js';
import bcryptjs from 'bcryptjs';
import { getAuthHeadersForUser } from './helpers/auth.js';

vi.mock('../mailtrap/emails.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

// Mock Redis:
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null), // Retornar null para que siempre consulte la base de datos
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
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key';
  
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  await User.deleteMany({});
  vi.clearAllMocks();
});

describe('Subscription Verification Middleware Flow', () => {
  it('should block customer (owner) with expired subscription', async () => {
    // 1. Crear dueño de negocio con suscripción expirada
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Expirada ayer

    const owner = await User.create({
      email: 'owner-expired@test.com',
      password: hashedPassword,
      name: 'Expired Owner',
      role: 'customer',
      subscriptionExpiresAt: expiredDate
    });

    // 2. Iniciar sesión directamente (stateless)
    const authHeaders = getAuthHeadersForUser(owner._id, owner.role);

    // 3. Acceder a una ruta protegida (p. ej. GET /api/categories)
    const response = await request(app)
      .get('/api/categories')
      .set(authHeaders);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('suscripción de 7 días ha vencido');
  });

  it('should block employee if their owner subscription is expired', async () => {
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Expirada ayer

    // 1. Crear dueño de negocio con suscripción expirada
    const owner = await User.create({
      email: 'owner-expired2@test.com',
      password: hashedPassword,
      name: 'Expired Owner 2',
      role: 'customer',
      subscriptionExpiresAt: expiredDate
    });

    // 2. Crear empleado que pertenece a ese dueño
    const employee = await User.create({
      email: 'employee@test.com',
      password: hashedPassword,
      name: 'Employee',
      role: 'employee',
      owner_id: owner._id,
      permissions: ['pos_access']
    });

    // 3. Iniciar sesión como el empleado directamente (stateless)
    const authHeaders = getAuthHeadersForUser(employee._id, employee.role, {
      ownerId: owner._id,
      permissions: employee.permissions
    });

    // 4. Acceder a una ruta protegida
    const response = await request(app)
      .get('/api/categories')
      .set(authHeaders);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('suscripción de 7 días ha vencido');
  });

  it('should allow employee if their owner subscription is active', async () => {
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const activeDate = new Date();
    activeDate.setDate(activeDate.getDate() + 5); // Activa por 5 días más

    // 1. Crear dueño con suscripción activa
    const owner = await User.create({
      email: 'owner-active@test.com',
      password: hashedPassword,
      name: 'Active Owner',
      role: 'customer',
      subscriptionExpiresAt: activeDate
    });

    // 2. Crear empleado
    const employee = await User.create({
      email: 'employee-active@test.com',
      password: hashedPassword,
      name: 'Employee Active',
      role: 'employee',
      owner_id: owner._id,
      permissions: ['pos_access']
    });

    // 3. Iniciar sesión como empleado directamente (stateless)
    const authHeaders = getAuthHeadersForUser(employee._id, employee.role, {
      ownerId: owner._id,
      permissions: employee.permissions
    });

    // 4. Acceder a una ruta protegida
    const response = await request(app)
      .get('/api/categories')
      .set(authHeaders);

    // No debería retornar 403. Debería poder pasar y obtener status 200 (lista vacía de categorías)
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.categories).toBeDefined();
  });
});
