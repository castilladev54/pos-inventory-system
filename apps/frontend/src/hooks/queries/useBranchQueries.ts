import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../api/axiosClient';
import type { Branch } from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const branchKeys = {
  all: ['branches'] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface CreateBranchPayload {
  name: string;
  address?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Obtiene el listado de sucursales según las credenciales del usuario autenticado */
export function useBranchesQuery() {
  return useQuery<Branch[]>({
    queryKey: branchKeys.all,
    queryFn: async ({ signal }) => {
      const res = await api.get('/api/branches', {
        signal,
        headers: { 'x-global-request': 'true' }
      });
      const data = res.data;
      return (data.branches ?? data.data ?? (Array.isArray(data) ? data : [])) as Branch[];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Crea una nueva sucursal e invalida la caché de 'branches' */
export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation<Branch, Error, CreateBranchPayload>({
    mutationFn: async (payload) => {
      const res = await api.post('api/branches', payload);
      return (res.data.branch ?? res.data.data ?? res.data) as Branch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}

