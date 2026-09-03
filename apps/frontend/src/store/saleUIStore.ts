import type { SaleId, SaleDetailDTO } from '@inventory/shared';
import { create } from 'zustand';

interface SaleUIState {
  viewedSaleId: SaleId | null;
  viewedSale: SaleDetailDTO | null;
  isEditMode: boolean;
  isEditModalOpen: boolean;
  openSaleDetail: (id: SaleId) => void;
  openEditMode: () => void;
  closeModals: () => void;
}

export const useSaleUIStore = create<SaleUIState>((set) => ({
  viewedSaleId: null,
  viewedSale: null,
  isEditMode: false,
  isEditModalOpen: false,
  openSaleDetail: (id) => set({ viewedSaleId: id, isEditMode: false, isEditModalOpen: false }),
  openEditMode: () => set({ isEditMode: true, isEditModalOpen: true }),
  closeModals: () => set({ viewedSaleId: null, viewedSale: null, isEditMode: false, isEditModalOpen: false }),
}));
