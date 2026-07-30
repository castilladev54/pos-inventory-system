/**
 * @deprecated Este store ha sido reemplazado por TanStack Query.
 * Usa los hooks en src/hooks/queries/useProductQueries.ts:
 *   - useProductsQuery()      para listar con paginaci�n
 *   - useAllProductsForPOS()  para el cat�logo del POS
 *   - useCreateProduct()      para crear
 *   - useUpdateProduct()      para actualizar
 *   - useDeleteProduct()      para eliminar
 *
 * Este archivo se mantendr� hasta que todos los componentes sean migrados.
 */import { create } from "zustand";
import API from "../api/axios";

const RESOURCE_URL = "/products";

export const useProductStore = create((set) => ({
  products: [],
  posProducts: [],      // catálogo completo para el POS (sin paginación)
  isPosLoading: false,  // loading exclusivo del fetch masivo
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
  isLoading: false,
  error: null,

  fetchProducts: async (page = 1, limit = 20, search = "") => {
    set({ isLoading: true, error: null });
    try {
      // Construir URL con paginación y, opcionalmente, búsqueda en servidor
      const params = new URLSearchParams({ page, limit });
      if (search.trim()) params.set("search", search.trim());

      const response = await API.get(`${RESOURCE_URL}?${params.toString()}`);
      const payload = response.data;

      // El backend devuelve los campos de paginación en el nivel raíz:
      // { success, products, total, totalPages, currentPage }
      const products = payload.products || payload.data || (Array.isArray(payload) ? payload : []);
      const total = payload.total ?? 0;
      const totalPages = payload.totalPages ?? 1;
      const currentPage = payload.currentPage ?? page;

      set({
        products,
        pagination: { total, page: currentPage, limit, totalPages },
        isLoading: false,
      });
    } catch (error) {
      // AGREGA ESTO PARA VER EL ESTADO REAL DEL ERROR HTTP
      console.log("Status Code del error:", error.response?.status);
      console.log("Cuerpo del error del backend:", error.response?.data);
      set({ error: error.response?.data?.message || "Error al obtener los productos", isLoading: false });
    }
  },

  /**
   * Carga TODO el catálogo activo en una sola petición (limit=5000).
   * Úsalo al abrir el POS para habilitar búsqueda local sin internet.
   * Los resultados se guardan en `posProducts` y no afectan a `products`.
   */
  fetchAllForPOS: async () => {
    set({ isPosLoading: true, error: null });
    try {
      const response = await API.get(`${RESOURCE_URL}?page=1&limit=5000`);
      const payload = response.data;
      const products =
        payload.products ||
        payload.data ||
        (Array.isArray(payload) ? payload : []);
      // Filtramos solo activos por si el backend no lo hace
      const active = products.filter((p) => p.isActive !== false);
      set({ posProducts: active, isPosLoading: false });
    } catch (error) {
      set({
        error: error.response?.data?.message || "Error al cargar el catálogo POS",
        isPosLoading: false,
      });
    }
  },

  createProduct: async (productData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post(RESOURCE_URL, productData);
      set((state) => ({
        products: [...state.products, response.data.product || response.data],
        isLoading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al crear el producto", isLoading: false });
      throw error;
    }
  },

  updateProduct: async (id, productData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.put(`${RESOURCE_URL}/${id}`, productData);
      set((state) => ({
        products: state.products.map((prod) =>
          prod._id === id ? response.data.product || response.data : prod
        ),
        isLoading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al actualizar el producto", isLoading: false });
      throw error;
    }
  },

  deleteProduct: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.delete(`${RESOURCE_URL}/${id}`);
      set((state) => ({
        products: state.products.filter((prod) => prod._id !== id),
        isLoading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Error al borrar el producto.", isLoading: false });
      throw error;
    }
  },

  fetchProductByBarcode: async (barcode) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get(`${RESOURCE_URL}/barcode/${barcode}`);
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || "Producto no encontrado", isLoading: false });
      throw error;
    }
  }
}));
