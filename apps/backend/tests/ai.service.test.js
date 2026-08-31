import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { getAIAdviceStreamService } from '../services/ai.service.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Purchase } from '../models/Purchase.js';
import { Category } from '../models/Category.js';
import { GoogleGenAI } from '@google/genai';

// Mockeamos la librería de Google Gen AI para no hacer peticiones reales ni gastar tokens
vi.mock('@google/genai', () => {
    const generateContentStreamMock = vi.fn().mockResolvedValue('mocked-stream');
    return {
        GoogleGenAI: class {
            constructor() {
                this.models = { generateContentStream: generateContentStreamMock };
            }
        }
    };
});

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
  await new Promise((r) => setTimeout(r, 2500));
}, 120000); 

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  await Product.deleteMany({});
  await Sale.deleteMany({});
  await SaleDetail.deleteMany({});
  await Purchase.deleteMany({});
  await Category.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();
});

describe('AI Service - getAIAdviceStreamService Integration', () => {
  let userId;
  let productId;
  let branchId; // Dummy ID — el servicio de IA consulta directamente los modelos, no pasa por la ruta HTTP
  
  beforeEach(async () => {
    branchId = new mongoose.Types.ObjectId();

    const user = await User.create({
      email: `aiuser${Date.now()}@test.com`,
      password: 'password123',
      name: 'AI Test User',
      role: 'admin'
    });
    userId = user._id.toString();

    const category = await Category.create({ name: 'Test Category', user: userId });
    
    // Producto crítico (stock global en Inventory, pero el servicio IA aún consulta Product.stock si existe)
    const product = await Product.create({
      name: 'Critical Engine',
      price: 1500,
      unit_type: 'kg',
      category: category._id,
      user: userId
    });
    productId = product._id.toString();
  });

  it('debe recopilar contexto base correctamente e inyectarlo en el AI prompt', async () => {
    // 1. Crear Venta Hoy
    const sale = await Sale.create({
      customer_id: userId,
      branch_id: branchId,
      payment_method: 'Efectivo',
      total_amount: 1500,
      customer_name: 'Juan Perez'
    });
    
    await SaleDetail.create({
      sale_id: sale._id,
      product_id: productId,
      quantity: 1,
      unit_price: 1500,
      subtotal: 1500
    });

    // 2. Ejecutar servicio
    const result = await getAIAdviceStreamService(userId, '¿Cómo me fue hoy?');
    
    // 3. Validaciones
    expect(result).toBe('mocked-stream');
    
    const genAiInstance = new GoogleGenAI();
    expect(genAiInstance.models.generateContentStream).toHaveBeenCalledTimes(1);
    
    const callArgs = genAiInstance.models.generateContentStream.mock.calls[0][0];
    const userMessageText = callArgs.contents[0].parts[0].text;
    
    // Verificamos que los datos extraídos estén en el prompt JSON
    expect(userMessageText).toContain('Critical Engine'); // Stock Crítico
    expect(userMessageText).toContain('1500'); // Monto de ventas
    expect(userMessageText).not.toContain('contexto_temporal'); // No preguntó por periodo largo
    expect(userMessageText).not.toContain('desglose_proveedores'); // No preguntó por deuda
  });

  it('debe agregar contexto_temporal cuando detecta intención de tiempo (ej. "semana")', async () => {
    // Agregamos venta vieja
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 3);
    
    await Sale.create({
      customer_id: userId,
      branch_id: branchId,
      payment_method: 'Efectivo',
      total_amount: 500,
      customer_name: 'Pedro',
      createdAt: oldDate
    });

    await getAIAdviceStreamService(userId, '¿Cómo me fue en la semana?');

    const genAiInstance = new GoogleGenAI();
    const callArgs = genAiInstance.models.generateContentStream.mock.calls[0][0];
    const userMessageText = callArgs.contents[0].parts[0].text;
    
    // Debería incluir contexto_temporal
    expect(userMessageText).toContain('contexto_temporal');
    expect(userMessageText).toContain('últimos 7 días');
    expect(userMessageText).toContain('resumen_diario');
  });

  it('debe agregar desglose_proveedores cuando detecta intención de deuda (ej. "deuda", "proveedores")', async () => {
    // Creamos compra con deuda (estado PENDING) y vencida
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);

    await Purchase.create({
      admin_id: userId,
      branch_id: branchId,
      supplier: 'Proveedor Malo',
      total_cost: 1000,
      due_date: pastDate,
      status: 'PENDING',
      paid_amount: 200
    });

    await getAIAdviceStreamService(userId, '¿Cuánto debo a los proveedores?');

    const genAiInstance = new GoogleGenAI();
    const callArgs = genAiInstance.models.generateContentStream.mock.calls[0][0];
    const userMessageText = callArgs.contents[0].parts[0].text;
    
    // Debería incluir detalles de deuda
    expect(userMessageText).toContain('desglose_proveedores');
    expect(userMessageText).toContain('Proveedor Malo');
    expect(userMessageText).toContain('VENCIDA'); // Ya que venció hace 2 días
    expect(userMessageText).toContain('800'); // 1000 - 200
  });

});
