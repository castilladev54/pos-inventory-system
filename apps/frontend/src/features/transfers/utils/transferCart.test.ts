import { describe, it, expect } from 'vitest';
import {
  TransferCartItem,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  TransferCartError
} from './transferCart';
import type { Product, BranchId, ProductId, UnitType } from '@inventory/shared';

describe('transferCart operations', () => {
  const sourceBranch = 'branch-1' as BranchId;
  const productId1 = 'prod-1' as ProductId;
  const productId2 = 'prod-2' as ProductId;

  const createMockProduct = (id: ProductId, stock: string, unit_type: UnitType = 'unidad'): Product => {
    return {
      _id: id,
      name: `Product ${id}`,
      unit_type,
      branchInventories: [
        { branch_id: sourceBranch, stock }
      ],
    } as unknown as Product;
  };

  describe('addItemToCart', () => {
    it('agrega stock al carrito correctamente (5 de stock 10 -> OK)', () => {
      const product = createMockProduct(productId1, '10');
      const cart: TransferCartItem[] = [];

      const newCart = addItemToCart(cart, product, sourceBranch, '5');
      expect(newCart).toHaveLength(1);
      expect(newCart[0]!.quantity).toBe('5');
      expect(newCart[0]!.product_id).toBe(productId1);
    });

    it('acumula stock correctamente (add 5, luego otros 5 de stock 10 -> OK)', () => {
      const product = createMockProduct(productId1, '10');
      let cart: TransferCartItem[] = [];

      cart = addItemToCart(cart, product, sourceBranch, '5');
      cart = addItemToCart(cart, product, sourceBranch, '5');
      
      expect(cart).toHaveLength(1);
      expect(cart[0]!.quantity).toBe('10');
    });

    it('rechaza si la cantidad excede el stock (add 1 extra -> RECHAZADO)', () => {
      const product = createMockProduct(productId1, '10');
      let cart: TransferCartItem[] = [];

      cart = addItemToCart(cart, product, sourceBranch, '5');
      cart = addItemToCart(cart, product, sourceBranch, '5');

      expect(() => {
        addItemToCart(cart, product, sourceBranch, '1');
      }).toThrowError(TransferCartError);
    });

    it('maneja decimales correctamente (stock 12.75, add 5.25, add 7.5 -> OK, add 0.01 -> RECHAZADO)', () => {
      const product = createMockProduct(productId1, '12.75', 'kg');
      let cart: TransferCartItem[] = [];

      cart = addItemToCart(cart, product, sourceBranch, '5.25');
      expect(cart[0]!.quantity).toBe('5.25');

      cart = addItemToCart(cart, product, sourceBranch, '7.5');
      expect(cart[0]!.quantity).toBe('12.75');

      expect(() => {
        addItemToCart(cart, product, sourceBranch, '0.01');
      }).toThrowError(TransferCartError);
    });

    it('rechaza cantidades en cero o negativas', () => {
      const product = createMockProduct(productId1, '10');
      const cart: TransferCartItem[] = [];

      expect(() => addItemToCart(cart, product, sourceBranch, '0')).toThrowError(TransferCartError);
      expect(() => addItemToCart(cart, product, sourceBranch, '-1')).toThrowError(TransferCartError);
    });
  });

  describe('updateCartItemQuantity', () => {
    it('actualiza la cantidad respetando el stock disponible', () => {
      const product = createMockProduct(productId1, '10');
      let cart = addItemToCart([], product, sourceBranch, '5');

      cart = updateCartItemQuantity(cart, product, sourceBranch, '8');
      expect(cart[0]!.quantity).toBe('8');
    });

    it('rechaza si la actualización excede el stock', () => {
      const product = createMockProduct(productId1, '10');
      const cart = addItemToCart([], product, sourceBranch, '5');

      expect(() => {
        updateCartItemQuantity(cart, product, sourceBranch, '11');
      }).toThrowError(TransferCartError);
    });

    it('lanza error si el producto no está en el carrito', () => {
      const product = createMockProduct(productId1, '10');
      expect(() => {
        updateCartItemQuantity([], product, sourceBranch, '5');
      }).toThrowError(TransferCartError);
    });
  });

  describe('removeCartItem', () => {
    it('elimina correctamente el ítem del carrito', () => {
      const product1 = createMockProduct(productId1, '10');
      const product2 = createMockProduct(productId2, '10');
      
      let cart = addItemToCart([], product1, sourceBranch, '5');
      cart = addItemToCart(cart, product2, sourceBranch, '3');

      expect(cart).toHaveLength(2);

      cart = removeCartItem(cart, productId1);
      expect(cart).toHaveLength(1);
      expect(cart[0]!.product_id).toBe(productId2);
    });
  });

  describe('clearCart', () => {
    it('vacía el carrito devolviendo un array vacío', () => {
      const product = createMockProduct(productId1, '10');
      let cart = addItemToCart([], product, sourceBranch, '5');

      cart = clearCart();
      expect(cart).toHaveLength(0);
      expect(cart).toEqual([]);
    });
  });
});
