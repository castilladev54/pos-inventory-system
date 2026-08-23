import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import API from '../../api/axios';
import type { UserProfile, UserPermission, UserId } from '@inventory/shared';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const staffKeys = {
  all: ['staff'] as const,
  lists: () => [...staffKeys.all, 'list'] as const,
};

// ─── Tipos de Payload ─────────────────────────────────────────────────────────

export interface CreateEmployeePayload {
  name: string;
  email: string;
  password?: string;
  permissions: UserPermission[];
  assigned_branches?: string[];
}

export interface UpdatePermissionsPayload {
  permissions: UserPermission[];
  assigned_branches?: string[];
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Lista de empleados y sus estadísticas de ventas */
export function useStaffQuery() {
  return useQuery<UserProfile[]>({
    queryKey: staffKeys.lists(),
    queryFn: async ({ signal }) => {
      const res = await API.get('/staff', { 
        signal,
        headers: { 'x-global-request': 'true' }
      });
      const data = res.data;
      return (data.employees ?? data.staff ?? data.data ?? (Array.isArray(data) ? data : [])) as UserProfile[];
    },
    staleTime: 2 * 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation<UserProfile, Error, CreateEmployeePayload>({
    mutationFn: async (payload) => {
      const res = await API.post('/staff', payload, {
        headers: { 'x-global-request': 'true' }
      });
      return (res.data.employee ?? res.data) as UserProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.all });
    },
  });
}

export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation<UserProfile, Error, { id: UserId; data: UpdatePermissionsPayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await API.put(`/staff/${id}`, data, {
        headers: { 'x-global-request': 'true' }
      });
      return (res.data.employee ?? res.data) as UserProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.all });
    },
  });
}

/** Elimina un empleado */
export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation<void, Error, UserId>({
    mutationFn: async (id) => {
      await API.delete(`/staff/${id}`, {
        headers: { 'x-global-request': 'true' }
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.all });
    },
  });
}
