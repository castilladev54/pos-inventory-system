import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { StockMovement } from '../models/StockMovement.js';
import { Sale } from '../models/Sale.js';
import { Branch } from '../models/Branch.js';
import { Inventory } from '../models/Inventory.js';
import bcryptjs from 'bcryptjs';
import { getAuthHeadersForUser } from './helpers/auth.js';

describe('Flujo Cruzado: Multi-Inquilino y Auditoría (Fase 3)', () => {
  let employeeHeaders;
  let employeeId;
  let productId;
  let categoryId;
  let ownerId;
  let branchId;

  let mongoReplSet;

  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoReplSet.getUri();
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
    await new Promise((r) => setTimeout(r, 1500));

    const hashedPassword = await bcryptjs.hash('password123', 10);

    // 1. Crear dueño — subscriptionExpiresAt en el futuro para evitar
    //    que checkSubscription corte el flujo con 403 en rutas protegidas.
    const owner = await User.create({
      name: 'Owner',
      email: `owner_${Date.now()}@test.com`,
      password: hashedPassword,
      role: 'customer',
      subscriptionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // +7 días
    });
    ownerId = owner._id.toString();

    // 2. Crear empleado
    const employeeEmail = `employee_${Date.now()}@test.com`;
    const employee = await User.create({
      name: 'Employee',
      email: employeeEmail,
      password: hashedPassword,
      role: 'employee',
      owner_id: ownerId,
      permissions: ['create_sale', 'edit_products']
    });
    employeeId = employee._id.toString();

    // Firmar JWT en memoria (síncrono) — inyecta el rol, permisos y el tenant ownerId
    // garantizando un flujo 100% stateless sin consultas redundantes a la base de datos.
    employeeHeaders = getAuthHeadersForUser(employee._id, 'employee', {
      permissions: ['create_sale', 'edit_products'],
      ownerId: ownerId
    });

    // 3. Crear categoría, producto y sucursal por el dueño
    const category = await Category.create({ name: 'Test Cat', user: ownerId });
    categoryId = category._id.toString();

    const product = await Product.create({
      name: 'Test Product',
      price: 100,
      category: categoryId,
      user: ownerId
    });
    productId = product._id.toString();

    const branch = await Branch.create({
      name: 'Sucursal Crossflow',
      address: 'Calle Test 99',
      owner_id: ownerId,
      is_active: true
    });
    branchId = branch._id.toString();

    // Stock inicial para el producto en la sucursal
    await Inventory.create({ owner_id: ownerId,  product_id: productId, branch_id: branchId, quantity: 10 });
  });

  afterAll(async () => {
    await User.deleteMany({ _id: { $in: [ownerId, employeeId] } });
    await Category.deleteMany({ _id: categoryId });
    await Product.deleteMany({ _id: productId });
    await StockMovement.deleteMany({ user_id: ownerId });
    await Sale.deleteMany({ customer_id: ownerId });
    await Branch.deleteMany({ _id: branchId });
    await Inventory.deleteMany({ branch_id: branchId });

    await mongoose.disconnect();
    if (mongoReplSet) {
      await mongoReplSet.stop();
    }
  });

  it('Empleado crea ajuste → created_by === empleadoId, user_id === dueñoId', async () => {
    const res = await request(app)
      .post('/api/adjustments')
      .set(employeeHeaders)
      .send({
        product_id: productId,
        branch_id: branchId,
        new_quantity: 15,
        reason: 'correction'
      });

    expect(res.status).toBe(201);
    
    // Verificar en BD
    const adj = await StockMovement.findById(res.body.adjustment._id).lean();
    expect(adj).not.toBeNull();
    expect(adj.user_id.toString()).toBe(ownerId);
    expect(adj.created_by.toString()).toBe(employeeId);
    expect(adj.new_quantity).toBe(15);
  });

  it('Empleado registra venta → sold_by === empleadoId, customer_id === dueñoId', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(employeeHeaders)
      .send({
        payment_method: 'Efectivo',
        branch_id: branchId,
        items: [{ product_id: productId, quantity: 2, unit_price: 100 }]
      });

    expect(res.status).toBe(201);
    
    // Verificar en BD
    const sale = await Sale.findById(res.body.sale._id).lean();
    expect(sale).not.toBeNull();
    expect(sale.customer_id.toString()).toBe(ownerId);
    expect(sale.sold_by.toString()).toBe(employeeId);
    expect(sale.total_amount).toBe(200);
  });
});
