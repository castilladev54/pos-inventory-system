import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import API from '../../api/axios';
import type { Category, CategoryId } from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (page: number, limit: number) => [...categoryKeys.lists(), { page, limit }] as const,
  catalog: () => [...categoryKeys.all, 'catalog'] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface CreateCategoryPayload {
  name: string;
  description?: string;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export interface CategoryListResponse {
  categories: Category[];
  total: number;
  totalPages: number;
  currentPage: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Lista paginada de categorías para la tabla de gestión */
export function useCategoriesQuery(page = 1, limit = 10) {
  return useQuery<CategoryListResponse>({
    queryKey: categoryKeys.list(page, limit),
    queryFn: async ({ signal }) => {
      const res = await API.get(`/categories?page=${page}&limit=${limit}`, { signal });
      const data = res.data;
      return {
        categories: data.categories ?? data.data ?? (Array.isArray(data) ? data : []),
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
        currentPage: data.currentPage ?? page,
      };
    },
    staleTime: 5 * 60_000,
  });
}

/** Catálogo completo sin paginación para selectores y dropdowns */
export function useAllCategoriesQuery() {
  return useQuery<Category[]>({
    queryKey: categoryKeys.catalog(),
    queryFn: async ({ signal }) => {
      const res = await API.get('/categories?page=1&limit=500', { signal });
      const data = res.data;
      return (data.categories ?? data.data ?? (Array.isArray(data) ? data : [])) as Category[];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation<Category, Error, CreateCategoryPayload>({
    mutationFn: async (payload) => {
      const res = await API.post('/categories', payload);
      return (res.data.category ?? res.data) as Category;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation<Category, Error, { id: CategoryId; data: UpdateCategoryPayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await API.put(`/categories/${id}`, data);
      return (res.data.category ?? res.data) as Category;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation<void, Error, CategoryId>({
    mutationFn: async (id) => {
      await API.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
