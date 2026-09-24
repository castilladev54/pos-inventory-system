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
