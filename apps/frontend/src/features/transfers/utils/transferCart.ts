import Big from 'big.js';
import type { Product, ProductId, UnitType, BranchId } from '@inventory/shared';
import { getProductStockForBranch } from './transferInventory';
import { TransferCartError } from './TransferCartError';

export { TransferCartError };

export interface TransferCartItem {
  product_id: ProductId;
  name: string;
  unit_type: UnitType;
  quantity: string;
}

export function addItemToCart(
  cart: TransferCartItem[],
  product: Product,
  sourceBranchId: BranchId,
  quantity: string
): TransferCartItem[] {
  let qtyToAdd: Big;
  try {
    qtyToAdd = new Big(quantity || '0');
  } catch (error) {
    throw new TransferCartError('Formato de cantidad inválido');
  }
  
  if (qtyToAdd.lte(0)) {
    throw new TransferCartError('La cantidad debe ser mayor a 0');
  }

  const stock = new Big(getProductStockForBranch(product, sourceBranchId));
  
  const existingItem = cart.find(item => item.product_id === product._id);
  const currentQty = existingItem ? new Big(existingItem.quantity) : new Big(0);
  
  const newQty = currentQty.plus(qtyToAdd);

  if (newQty.gt(stock)) {
    throw new TransferCartError('Stock insuficiente en la sucursal de origen');
  }

  if (existingItem) {
    return cart.map(item =>
      item.product_id === product._id
        ? { ...item, quantity: newQty.toString() }
        : item
    );
  }

  return [
    ...cart,
    {
      product_id: product._id,
      name: product.name,
      unit_type: product.unit_type,
      quantity: qtyToAdd.toString(),
    }
  ];
}

export function updateCartItemQuantity(
  cart: TransferCartItem[],
  product: Product,
  sourceBranchId: BranchId,
  quantity: string
): TransferCartItem[] {
  let newQty: Big;
  try {
    newQty = new Big(quantity || '0');
  } catch (error) {
    throw new TransferCartError('Formato de cantidad inválido');
  }
  
  if (newQty.lte(0)) {
    throw new TransferCartError('La cantidad debe ser mayor a 0');
  }

  const stock = new Big(getProductStockForBranch(product, sourceBranchId));

  if (newQty.gt(stock)) {
    throw new TransferCartError('Stock insuficiente en la sucursal de origen');
  }

  const existingItem = cart.find(item => item.product_id === product._id);
  if (!existingItem) {
    throw new TransferCartError('El producto no está en el carrito');
  }

  return cart.map(item =>
    item.product_id === product._id
      ? { ...item, quantity: newQty.toString() }
      : item
  );
}

export function removeCartItem(
  cart: TransferCartItem[],
  productId: ProductId
): TransferCartItem[] {
  return cart.filter(item => item.product_id !== productId);
}

export function clearCart(): TransferCartItem[] {
  return [];
}
