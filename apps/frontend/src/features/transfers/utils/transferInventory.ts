import Big from 'big.js';
import type { BranchId, Product } from '@inventory/shared';

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
  const stockBig = new Big(stock);
  const inCartBig = new Big(inCart || '0');

  const remaining = stockBig.minus(inCartBig);
  return remaining.gt(0) ? remaining.toString() : '0';
}
