import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server'; // ! OJO: Usamos ReplSet
import app from '../server.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { PurchaseDetail } from '../models/PurchaseDetail.js';
import { Branch } from '../models/Branch.ts';
import { BranchInventory } from '../models/BranchInventory.ts';
import bcryptjs from 'bcryptjs';
import { getAuthHeadersForUser } from './helpers/auth.js';

// Mockeamos la librerÃ­a de correos para evitar envÃ­os reales
vi.mock('../mailtrap/emails.js', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendResetSuccessEmail: vi.fn(),
}));

// Mock Redis COMPLETO: cubre tanto lib/redis.js (getOrSetCache/invalidateCache)
// como el cache.middleware.js que llama redis.get() y redis.set() directamente.
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null),   // Simula siempre MISS de cachÃ© â†’ pasa al controlador
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
  // CRÃTICO: El controlador de Purchases usa Transacciones (session.startTransaction()).
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoReplSet.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
  await new Promise((r) => setTimeout(r, 2500));
}, 120000); 

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) {
    await mongoReplSet.stop();
  }
});

afterEach(async () => {
  await Purchase.deleteMany({});
  await PurchaseDetail.deleteMany({});
  await BranchInventory.deleteMany({});
  await User.updateMany({}, { av_inventory_cost: 0 });
  
  vi.clearAllMocks();
});

describe('Purchase Controllers Integration', () => {
  let authHeaders;
  let userId;
  let categoryId;
  let productId;
  let branchId;
  
  beforeAll(async () => {
    // 1. Iniciamos usuario Ãºnico para todo el bloque directamente en DB
    const testEmail = `purchaser${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
    const hashedPassword = await bcryptjs.hash('password123', 10);
    const user = await User.create({
      email: testEmail,
      password: hashedPassword,
      name: 'Purchaser Admin',
      role: 'admin'
    });
    userId = user._id.toString();
    
    // 2. Iniciamos sesiÃ³n y guardamos cookie JWT
    authHeaders = getAuthHeadersForUser(user._id, user.role);

    // 3. Crear CategorÃ­a en BD
    const category = new Category({ name: 'Car Parts', user: userId });
    await category.save();
    categoryId = category._id.toString();

    // Crear sucursal de prueba
    const branch = await Branch.create({
      name: 'Sucursal Compras Principal',
      address: 'Calle de las Compras 99',
      owner_id: userId,
      is_active: true
    });
    branchId = branch._id.toString();

    // 4. Crear Producto en BD (con stock inicial 0)
    const product = new Product({
      name: 'Engine X1',
      price: 1500,
      unit_type: 'kg', // Setteado a kg para soportar decimales en los test
      category: categoryId,
      user: userId
    });
    await product.save();
    productId = product._id.toString();

    // Inyectar el stock inicial en la sucursal de prueba
    await BranchInventory.create({
      product_id: product._id,
      branch_id: branchId,
      stock: 0,
      min_stock: 0
    });
  });

  describe('POST /api/purchases', () => {
    it('should create a purchase with FRACTIONAL quantities (kg support), automatically INCREMENT product stock, and recalculate average costs', async () => {
      const payload = {
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Global Supplier Corp',
        items: [
          {
            product_id: productId,
            quantity: 15.5, // Â¡Probando nuestra funciÃ³n de fracciones / kilos!
            unit_cost: 100 // total cost of this item line = 1550
          }
        ]
      };

      const response = await request(app)
        .post('/api/purchases')
        .set(authHeaders)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.purchase.supplier).toBe('Global Supplier Corp');
      expect(response.body.purchase.total_cost).toBe(1550); // 15.5 * 100
      
      const purchaseId = response.body.purchase._id;

      // 1. Verifica los Detalles Reales creados en BD
      const details = await PurchaseDetail.find({ purchase_id: purchaseId });
      expect(details).toHaveLength(1);
      expect(details[0].product_id.toString()).toBe(productId);
      expect(details[0].quantity).toBe(15.5);

      // 2. STOCK DE SUCURSAL INCREMENTADO:
      const branchInv = await BranchInventory.findOne({ product_id: productId, branch_id: branchId });
      expect(branchInv.stock).toBe(15.5);

      // El pre-save de PurchaseDetail tambiÃ©n debiÃ³ actualizar el "av_inventory_cost" en User.
      const updatedUser = await User.findById(userId);
      expect(updatedUser.av_inventory_cost).toBe(100); 
    });

    it('should correctly rollback transaction (abortTransaction) and return 404 if product does not exist', async () => {
      const fakeProductId = new mongoose.Types.ObjectId().toString();
      const payload = {
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Bad Supplier',
        items: [{ product_id: fakeProductId, quantity: 5.2, unit_cost: 50 }]
      };

      const response = await request(app)
        .post('/api/purchases')
        .set(authHeaders)
        .send(payload);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('no encontrado');

      // Fundamental: Si fallÃ³, la transacciÃ³n hace rollback. Ninguna compra ni detalle debiÃ³ registrarse.
      const purchasesCount = await Purchase.countDocuments();
      expect(purchasesCount).toBe(0);
    });

    it('should return 400 validation error if required body payload missing (e.g. items array)', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set(authHeaders)
        .send({ admin_id: userId, branch_id: branchId, supplier: 'No items supplier, will crash' });

      // Bad Request from Zod Validator
      expect(response.status).toBe(400); 
    });
  });

  describe('GET /api/purchases', () => {
    it('should return a list of purchases belonging to the logged user', async () => {
      // Creamos una de forma limpia
      await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Test Supplier 123',
        items: [{ product_id: productId, quantity: 2, unit_cost: 50 }]
      });

      const response = await request(app).get('/api/purchases').set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.purchases).toHaveLength(1);
      expect(response.body.purchases[0].supplier).toBe('Test Supplier 123');
      expect(response.body.purchases[0].admin_id).toHaveProperty('email'); // Populated relation
    });
  });

  describe('GET /api/purchases/:id', () => {
    it('should retrieve a single purchase and its mapped purchase details', async () => {
      const createRes = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Single Detail Prov',
        items: [{ product_id: productId, quantity: 5, unit_cost: 30 }]
      });
      const purchaseId = createRes.body.purchase._id;

      const response = await request(app).get(`/api/purchases/${purchaseId}`).set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.purchase._id).toBe(purchaseId);
      
      // Verifica que traiga los items empaquetados juntos
      expect(response.body.details).toHaveLength(1);
      // Verifica populaciÃ³n de la tabla de detalles con la de productos (nombre)
      expect(response.body.details[0].product_id.name).toBe('Engine X1'); 
    });

    it('should return 404 for a non-existent purchase search', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).get(`/api/purchases/${fakeId}`).set(authHeaders);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('POST /api/purchases (due_date handling)', () => {
    it('should assign a default due_date of 30 days when none is provided', async () => {
      const beforeCreate = new Date();

      const response = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Default Due Supplier',
        items: [{ product_id: productId, quantity: 1, unit_cost: 50 }]
      });

      expect(response.status).toBe(201);

      // Verificar en BD que el due_date se asignÃ³ ~30 dÃ­as en el futuro
      const purchase = await Purchase.findById(response.body.purchase._id);
      const expectedMin = new Date(beforeCreate);
      expectedMin.setDate(expectedMin.getDate() + 29); // margen de 1 dÃ­a por timing

      expect(purchase.due_date).toBeDefined();
      expect(new Date(purchase.due_date).getTime()).toBeGreaterThan(expectedMin.getTime());
      expect(purchase.status).toBe('PENDING');
      expect(purchase.paid_amount).toBe(0);
    });

    it('should use a custom dueDate when provided in the request body', async () => {
      const customDate = '2026-06-15T00:00:00.000Z';

      const response = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Custom Due Supplier',
        items: [{ product_id: productId, quantity: 2, unit_cost: 25 }],
        dueDate: customDate
      });

      expect(response.status).toBe(201);

      const purchase = await Purchase.findById(response.body.purchase._id);
      expect(new Date(purchase.due_date).toISOString()).toBe(customDate);
    });
  });

  describe('GET /api/purchases (Filtros por Estado y Vencimiento)', () => {
    it('should filter purchases by status=PENDING', async () => {
      // Crear una compra (status por defecto: PENDING)
      await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Pending Supplier',
        items: [{ product_id: productId, quantity: 1, unit_cost: 100 }]
      });

      const response = await request(app)
        .get('/api/purchases?status=PENDING')
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.purchases.length).toBeGreaterThanOrEqual(1);
      response.body.purchases.forEach(p => {
        expect(p.status).toBe('PENDING');
      });
    });

    it('should filter purchases by status=PAID (returns empty if none paid)', async () => {
      // Crear una compra (status PENDING por defecto)
      await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Unpaid Supplier',
        items: [{ product_id: productId, quantity: 5, unit_cost: 50 }]
      });

      const response = await request(app)
        .get('/api/purchases?status=PAID')
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.purchases).toHaveLength(0);
    });

    it('should filter overdue purchases (filterBy=overdue)', async () => {
      // Crear compra con due_date en el pasado directamente en BD
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10); // VenciÃ³ hace 10 dÃ­as
      
      await Purchase.create({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Overdue Supplier',
        total_cost: 500,
        due_date: pastDate,
        status: 'PENDING',
        paid_amount: 0
      });

      const response = await request(app)
        .get('/api/purchases?filterBy=overdue')
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.purchases.length).toBeGreaterThanOrEqual(1);
      
      // Todas las devueltas deben tener due_date < hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      response.body.purchases.forEach(p => {
        expect(new Date(p.due_date).getTime()).toBeLessThan(today.getTime());
      });
    });

    it('should filter expiring soon purchases (filterBy=expiringSoon)', async () => {
      // Crear compra con due_date en 3 dÃ­as (dentro del rango de 7 dÃ­as)
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 3);
      
      await Purchase.create({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Soon Supplier',
        total_cost: 300,
        due_date: soonDate,
        status: 'PENDING',
        paid_amount: 0
      });

      const response = await request(app)
        .get('/api/purchases?filterBy=expiringSoon')
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.purchases.length).toBeGreaterThanOrEqual(1);
      
      const supplierNames = response.body.purchases.map(p => p.supplier);
      expect(supplierNames).toContain('Soon Supplier');
    });

    it('should NOT return PAID purchases in overdue or expiringSoon filters', async () => {
      // Crear compra PAGADA con due_date vencida
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      
      await Purchase.create({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Already Paid Old',
        total_cost: 200,
        due_date: pastDate,
        status: 'PAID',
        paid_amount: 200,
        payment_date: new Date()
      });
      pastDate.setDate(pastDate.getDate() - 5);
      
      await Purchase.create({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Already Paid Old',
        total_cost: 200,
        due_date: pastDate,
        status: 'PAID',
        paid_amount: 200,
        payment_date: new Date()
      });

      const overdueRes = await request(app)
        .get('/api/purchases?filterBy=overdue')
        .set(authHeaders);

      // La compra pagada NO debe aparecer en overdue
      const overdueSuppliers = overdueRes.body.purchases.map(p => p.supplier);
      expect(overdueSuppliers).not.toContain('Already Paid Old');
    });
  });

  describe('PUT /api/purchases/:id/pay (Abonos y Pagos)', () => {
    it('should register a PARTIAL payment and update status to PARTIAL', async () => {
      // Crear compra de $1000
      const createRes = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Partial Pay Supplier',
        items: [{ product_id: productId, quantity: 10, unit_cost: 100 }]
      });
      const purchaseId = createRes.body.purchase._id;

      // Abonar $400 de $1000
      const payRes = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 400 });

      expect(payRes.status).toBe(200);
      expect(payRes.body.success).toBe(true);
      expect(payRes.body.purchase.status).toBe('PARTIAL');
      expect(payRes.body.purchase.paid_amount).toBe(400);
      expect(payRes.body.purchase.payment_date).toBeUndefined(); // AÃºn no se ha liquidado
    });

    it('should mark purchase as PAID when full amount is covered', async () => {
      // Crear compra de $500
      const createRes = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Full Pay Supplier',
        items: [{ product_id: productId, quantity: 5, unit_cost: 100 }]
      });
      const purchaseId = createRes.body.purchase._id;

      // Pagar los $500 completos
      const payRes = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 500 });

      expect(payRes.status).toBe(200);
      expect(payRes.body.purchase.status).toBe('PAID');
      expect(payRes.body.purchase.paid_amount).toBe(500);
      expect(payRes.body.purchase.payment_date).toBeDefined(); // Fecha de pago registrada
    });

    it('should accumulate multiple partial payments until PAID', async () => {
      // Crear compra de $300
      const createRes = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Multi Pay Supplier',
        items: [{ product_id: productId, quantity: 3, unit_cost: 100 }]
      });
      const purchaseId = createRes.body.purchase._id;

      // Primer abono: $100
      const pay1 = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 100 });
      expect(pay1.body.purchase.status).toBe('PARTIAL');
      expect(pay1.body.purchase.paid_amount).toBe(100);

      // Segundo abono: $100 â†’ total $200
      const pay2 = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 100 });
      expect(pay2.body.purchase.status).toBe('PARTIAL');
      expect(pay2.body.purchase.paid_amount).toBe(200);

      // Tercer abono: $100 â†’ total $300 = PAGADO
      const pay3 = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 100 });
      expect(pay3.body.purchase.status).toBe('PAID');
      expect(pay3.body.purchase.paid_amount).toBe(300);
      expect(pay3.body.purchase.payment_date).toBeDefined();
    });

    it('should cap paid_amount to total_cost if overpaying', async () => {
      // Crear compra de $200
      const createRes = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Overpay Supplier',
        items: [{ product_id: productId, quantity: 2, unit_cost: 100 }]
      });
      const purchaseId = createRes.body.purchase._id;

      // Pagar $999 (mÃ¡s del total de $200)
      const payRes = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 999 });

      expect(payRes.status).toBe(200);
      expect(payRes.body.purchase.status).toBe('PAID');
      expect(payRes.body.purchase.paid_amount).toBe(200); // Nivelado al total, no $999
    });

    it('should return 400 when trying to pay an already PAID purchase', async () => {
      // Crear y pagar completamente
      const createRes = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Double Pay Supplier',
        items: [{ product_id: productId, quantity: 1, unit_cost: 50 }]
      });
      const purchaseId = createRes.body.purchase._id;

      // Pagar todo
      await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 50 });

      // Intentar pagar de nuevo â†’ ERROR
      const payAgain = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 10 });

      expect(payAgain.status).toBe(400);
      expect(payAgain.body.message).toContain('pagada completamente');
    });

    it('should return 400 if amount is zero or negative', async () => {
      const createRes = await request(app).post('/api/purchases').set(authHeaders).send({
        admin_id: userId,
        branch_id: branchId,
        supplier: 'Zero Pay Supplier',
        items: [{ product_id: productId, quantity: 1, unit_cost: 100 }]
      });
      const purchaseId = createRes.body.purchase._id;

      const zeroRes = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: 0 });
      expect(zeroRes.status).toBe(400);

      const negativeRes = await request(app)
        .put(`/api/purchases/${purchaseId}/pay`)
        .set(authHeaders)
        .send({ amount: -50 });
      expect(negativeRes.status).toBe(400);
    });

    it('should return 404 when paying a non-existent purchase', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .put(`/api/purchases/${fakeId}/pay`)
        .set(authHeaders)
        .send({ amount: 100 });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('no encontrada');
    });
  });
});
