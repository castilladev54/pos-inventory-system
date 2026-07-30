import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import API from '../../api/axios';
import type {
  Product,
  ProductId,
  ApiProductResponse,
} from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (page: number, limit: number, search: string) =>
    [...productKeys.lists(), { page, limit, search }] as const,
  posCatalog: () => [...productKeys.all, 'pos-catalog'] as const,
  barcode: (code: string) => [...productKeys.all, 'barcode', code] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface CreateProductPayload {
  name: string;
  description: string;
  price: number;
  category: string;
  barcode?: string;
  unit_type: 'unidad' | 'kg' | 'litro' | 'metro';
  /** Stock inicial para la sucursal activa */
  initialStock?: number;
  minStock?: number;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

interface ProductListResponse {
  products: Product[];
  total: number;
  totalPages: number;
  currentPage: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Lista paginada de productos con búsqueda opcional.
 * keepPreviousData evita el flasheo al cambiar de página.
 */
export function useProductsQuery(page: number, limit: number, search: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());

  return useQuery<ProductListResponse>({
    queryKey: productKeys.list(page, limit, search),
    queryFn: async ({ signal }) => {
      const res = await API.get(`/products?${params.toString()}`, { signal });
      const data = res.data;
      return {
        products: data.products ?? data.data ?? (Array.isArray(data) ? data : []),
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
        currentPage: data.currentPage ?? page,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000, // 1 minuto — igual que el TTL de Redis del backend (5min), más conservador en cliente
  });
}

/**
 * Catálogo completo para el POS (sin paginación).
 * staleTime más largo porque el catálogo POS no se invalida frecuentemente.
 */
export function useAllProductsForPOS() {
  return useQuery<Product[]>({
    queryKey: productKeys.posCatalog(),
    queryFn: async ({ signal }) => {
      const res = await API.get('/products?page=1&limit=5000', { signal });
      const data = res.data;
      const products: Product[] = data.products ?? data.data ?? (Array.isArray(data) ? data : []);
      return products.filter((p) => p.isActive !== false);
    },
    staleTime: 5 * 60_000,  // 5 minutos — alineado con TTL de Redis del backend
    gcTime: 10 * 60_000,
  });
}

/**
 * Busca un producto por su código de barras.
 * Se dispara de forma imperativa (enabled: false) desde mutateAsync.
 */
export function useProductByBarcodeQuery(barcode: string, enabled: boolean) {
  return useQuery<ApiProductResponse>({
    queryKey: productKeys.barcode(barcode),
    queryFn: async ({ signal }) => {
      const res = await API.get(`/products/barcode/${barcode}`, { signal });
      return res.data as ApiProductResponse;
    },
    enabled: enabled && barcode.length >= 5,
    staleTime: 30_000,
    retry: false,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation<ApiProductResponse, Error, CreateProductPayload>({
    mutationFn: async (payload) => {
      const res = await API.post('/products', payload);
      return res.data as ApiProductResponse;
    },
    onSuccess: () => {
      // Invalida TODAS las listas de productos (incluye POS catalog)
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation<ApiProductResponse, Error, { id: ProductId; data: UpdateProductPayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await API.put(`/products/${id}`, data);
      return res.data as ApiProductResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation<void, Error, ProductId>({
    mutationFn: async (id) => {
      await API.delete(`/products/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
