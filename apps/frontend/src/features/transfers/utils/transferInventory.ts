import Big from 'big.js';
import type { BranchId, Product } from '@inventory/shared';
import { TransferCartError } from './TransferCartError';

export function getProductStockForBranch(
  product: Product,
  branchId: BranchId,
): string {
  // Aseguramos que la propiedad exista antes de llamar a find
  if (!product.branchInventories) {
    return '0';
  }

  const inventory = product.branchInventories.find(
    (item) => item.branch_id === branchId,
  );

  return inventory?.stock ?? '0';
}

export function getTransferableQuantity(
  product: Product,
  branchId: BranchId,
  inCart: string,
): string {
  const stock = getProductStockForBranch(product, branchId);
  
  let stockBig: Big;
  let inCartBig: Big;
  try {
    stockBig = new Big(stock);
    inCartBig = new Big(inCart || '0');
  } catch (error) {
    throw new TransferCartError('Formato de cantidad inválido');
  }

  const remaining = stockBig.minus(inCartBig);
  return remaining.gt(0) ? remaining.toString() : '0';
}
