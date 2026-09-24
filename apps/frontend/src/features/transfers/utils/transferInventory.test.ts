import { describe, it, expect } from 'vitest';
import { getProductStockForBranch, getTransferableQuantity } from './transferInventory';
import type { Product, BranchId } from '@inventory/shared';

describe('getProductStockForBranch', () => {
  const branchA = 'branch-a' as BranchId;
  const branchB = 'branch-b' as BranchId;
  const branchC = 'branch-c' as BranchId;

  // Helper para construir productos simulados omitiendo los campos irrelevantes para este test
  const createMockProduct = (branchInventories: any[] = [], totalStock: string = '0'): Product => {
    return {
      _id: 'mock-product-id',
      name: 'Mock Product',
      price: 100,
      totalStock,
      branchInventories,
    } as unknown as Product; 
  };

  it('1. Producto con inventario en branch -> devuelve stock correcto', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '10' }]);
    expect(getProductStockForBranch(product, branchA)).toBe('10');
  });

  it('2. Producto sin inventario en branch -> devuelve "0"', () => {
    const product = createMockProduct();
    expect(getProductStockForBranch(product, branchA)).toBe('0');
  });

  it('3. Producto con inventario en otra sucursal -> devuelve "0"', () => {
    const product = createMockProduct([{ branch_id: branchB, stock: '5' }]);
    expect(getProductStockForBranch(product, branchA)).toBe('0');
  });

  it('4. Stock decimal -> conserva "12.75"', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '12.75' }]);
    expect(getProductStockForBranch(product, branchA)).toBe('12.75');
  });

  it('5. Varias sucursales -> selecciona exclusivamente sourceBranchId', () => {
    const product = createMockProduct([
      { branch_id: branchA, stock: '12.75' },
      { branch_id: branchB, stock: '17.25' }
    ]);
    expect(getProductStockForBranch(product, branchA)).toBe('12.75');
    expect(getProductStockForBranch(product, branchB)).toBe('17.25');
  });

  it('6. Nunca utiliza totalStock -> incluso si totalStock es mayor', () => {
    const product = createMockProduct([
      { branch_id: branchA, stock: '2' },
    ], '50');
    expect(getProductStockForBranch(product, branchA)).toBe('2');
    expect(getProductStockForBranch(product, branchC)).toBe('0'); // Fallback to '0', ignored totalStock
  });
});

describe('getTransferableQuantity', () => {
  const branchA = 'branch-a' as BranchId;

  const createMockProduct = (branchInventories: any[] = [], totalStock: string = '0'): Product => {
    return {
      _id: 'mock-product-id',
      name: 'Mock Product',
      price: 100,
      totalStock,
      branchInventories,
    } as unknown as Product;
  };

  it('stock 10, carrito 0 -> "10"', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '10' }]);
    expect(getTransferableQuantity(product, branchA, '0')).toBe('10');
  });

  it('stock 10, carrito 3 -> "7"', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '10' }]);
    expect(getTransferableQuantity(product, branchA, '3')).toBe('7');
  });

  it('stock 10, carrito 10 -> "0"', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '10' }]);
    expect(getTransferableQuantity(product, branchA, '10')).toBe('0');
  });

  it('stock 10, carrito 12 -> "0"', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '10' }]);
    expect(getTransferableQuantity(product, branchA, '12')).toBe('0');
  });

  it('stock 12.75, carrito 2 -> "10.75"', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '12.75' }]);
    expect(getTransferableQuantity(product, branchA, '2')).toBe('10.75');
  });

  it('stock 0, carrito 0 -> "0"', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '0' }]);
    expect(getTransferableQuantity(product, branchA, '0')).toBe('0');
  });

  it('stock 0.3, carrito 0.1 -> "0.2"', () => {
    const product = createMockProduct([{ branch_id: branchA, stock: '0.3' }]);
    expect(getTransferableQuantity(product, branchA, '0.1')).toBe('0.2');
  });
});
