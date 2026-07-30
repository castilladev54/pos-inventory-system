import { create } from "zustand";
import API from "../api/axios";

const API_URL = "/sales";



export const useSaleStore = create((set) => ({
  sales: [],
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
  isLoading: false,
  error: null,

  fetchSales: async (page = 1, limit = 20, seller = null, dateFilter = 'all', dateFrom = undefined, dateTo = undefined, paymentMethod = 'all') => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({ page, limit });
      if (seller) params.append('seller', seller);
      if (dateFilter && dateFilter !== 'all') params.append('dateFilter', dateFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (paymentMethod && paymentMethod !== 'all') params.append('paymentMethod', paymentMethod);

      const response = await API.get(`${API_URL}?${params.toString()}`);
      const payload = response.data;

      // El backend devuelve los campos de paginación en el nivel raíz:
      // { success, sales, total, totalPages, currentPage, totalAmount }
      const sales = payload.sales || payload.data || (Array.isArray(payload) ? payload : []);
      const total = payload.total ?? 0;
      const totalPages = payload.totalPages ?? 1;
      const currentPage = payload.currentPage ?? page;
      const totalAmount = payload.totalAmount ?? 0;

      set({
        sales,
        pagination: { total, page: currentPage, limit, totalPages, totalAmount },
        isLoading: false,
      });
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al obtener el historial de ventas", isLoading: false });
    }
  },

  createSale: async (saleData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post(API_URL, saleData);
      set((state) => ({
        sales: [response.data.sale || response.data, ...state.sales],
        isLoading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al registrar la venta", isLoading: false });
      throw error;
    }
  },

  cancelSale: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.put(`${API_URL}/${id}/cancel`);
      set((state) => ({
        sales: state.sales.map((s) => s._id === id ? { ...s, status: "Anulada", total_amount: 0 } : s),
        isLoading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al anular la venta", isLoading: false });
      throw error;
    }
  },

  updateSale: async (id, updateData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.patch(`${API_URL}/${id}`, updateData);
      set((state) => ({
        sales: state.sales.map((s) => s._id === id ? { ...s, ...response.data.sale } : s),
        isLoading: false
      }));
      return response.data.sale || response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al actualizar la venta", isLoading: false });
      throw error;
    }
  },

  fetchSaleById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get(`${API_URL}/${id}`);
      set({ isLoading: false });
      return response.data.sale || response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al obtener el detalle de la venta", isLoading: false });
      throw error;
    }
  }
}));
