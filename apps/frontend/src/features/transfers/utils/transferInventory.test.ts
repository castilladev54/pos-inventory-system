import { describe, it, expect } from 'vitest';
import { getProductStockForBranch } from './transferInventory';
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
