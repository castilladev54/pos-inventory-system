import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import { createAdminUser, createBranch, generateJwt } from './helpers/testUtils.js';

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
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

describe('Security and Authentication (Tenant & Branch Isolation)', () => {
  let tenant1;
  let tenant1Branch;
  let tenant2;
  let tenant2Branch;

  beforeAll(async () => {
    // Crear Tenant 1
    tenant1 = await createAdminUser('tenant1');
    const branchRes1 = await createBranch(tenant1.userId, { name: 'Branch T1' });
    tenant1Branch = branchRes1.branchId.toString();

    // Crear Tenant 2
    tenant2 = await createAdminUser('tenant2');
    const branchRes2 = await createBranch(tenant2.userId, { name: 'Branch T2' });
    tenant2Branch = branchRes2.branchId.toString();
  });

  describe('Branch Jurisdiction and Tenant Isolation', () => {
    it('should reject request if branch belongs to a different tenant', async () => {
      // Tenant 1 tries to access Tenant 2's branch
      const response = await request(app)
        .get('/api/products')
        .set({ ...tenant1.authHeaders, 'x-branch-id': tenant2Branch });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/No tienes acceso a esta sucursal|sucursal no pertenece/i);
    });

    it('should reject request if branch does not exist', async () => {
      const fakeBranchId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get('/api/products')
        .set({ ...tenant1.authHeaders, 'x-branch-id': fakeBranchId });

      expect([403, 404]).toContain(response.status);
    });

    it('should allow request if branch belongs to the tenant', async () => {
      const response = await request(app)
        .get('/api/products')
        .set({ ...tenant1.authHeaders, 'x-branch-id': tenant1Branch });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Employee Jurisdiction', () => {
    let employeeHeaders;

    beforeAll(() => {
      // Create employee JWT belonging to tenant1 but NO assigned branches
      employeeHeaders = generateJwt(new mongoose.Types.ObjectId(), 'employee', {
        ownerId: tenant1.userId,
        assignedBranches: []
      });
    });

    it('should reject employee if trying to access an unassigned branch (even if it belongs to their tenant)', async () => {
      const response = await request(app)
        .get('/api/products')
        .set({ ...employeeHeaders, 'x-branch-id': tenant1Branch });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/No tienes acceso a esta sucursal|no asignada/i);
    });

    it('should allow employee if trying to access an assigned branch', async () => {
      const allowedEmployeeHeaders = generateJwt(new mongoose.Types.ObjectId(), 'employee', {
        ownerId: tenant1.userId,
        assignedBranches: [tenant1Branch]
      });

      const response = await request(app)
        .get('/api/products')
        .set({ ...allowedEmployeeHeaders, 'x-branch-id': tenant1Branch });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
