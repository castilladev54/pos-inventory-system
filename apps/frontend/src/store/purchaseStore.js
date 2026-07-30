import { create } from "zustand";
import API from "../api/axios";

const API_URL = "/purchases";

export const usePurchaseStore = create((set) => ({
  purchases: [],
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
  payments: [],
  isLoading: false,
  error: null,

  fetchPurchases: async (page = 1, limit = 20) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get(`${API_URL}?page=${page}&limit=${limit}`);
      const payload = response.data;

      // El backend devuelve los campos de paginación en el nivel raíz:
      // { success, purchases, total, totalPages, currentPage }
      const purchases = payload.purchases || payload.data || (Array.isArray(payload) ? payload : []);
      const total = payload.total ?? 0;
      const totalPages = payload.totalPages ?? 1;
      const currentPage = payload.currentPage ?? page;

      set({
        purchases,
        pagination: { total, page: currentPage, limit, totalPages },
        isLoading: false,
      });
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al obtener el historial de compras", isLoading: false });
    }
  },

  fetchPayments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get(`${API_URL}/payments`);
      set({ payments: response.data.payments || response.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al obtener el historial de pagos", isLoading: false });
    }
  },

  createPurchase: async (purchaseData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post(API_URL, purchaseData);
      set((state) => ({
        purchases: [response.data.purchase || response.data, ...state.purchases],
        isLoading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al registrar la compra", isLoading: false });
      throw error;
    }
  },

  fetchPurchaseById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get(`${API_URL}/${id}`);
      set({ isLoading: false });
      return response.data.purchase || response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al obtener el detalle de la compra", isLoading: false });
      throw error;
    }
  },

  payPurchase: async (id, paymentData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.put(`${API_URL}/${id}/pay`, paymentData);

      // Update the local purchase if found
      set((state) => ({
        purchases: state.purchases.map(p =>
          p._id === id ? { ...p, ...((response.data.purchase || response.data) || {}) } : p
        ),
        isLoading: false
      }));
      return response.data.purchase || response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al registrar el abono", isLoading: false });
      throw error;
    }
  }
}));
