import type { Branch, BranchId } from '@inventory/shared';

export function getBranchName(value: BranchId | Branch): string {
  if (!value) return '—';
  return typeof value === 'string' ? value : value.name;
}
