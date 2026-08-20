import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, Branch, BranchId } from '@inventory/shared';
import { api } from '../api/axiosClient';
import axios from 'axios';

// Importación diferida para evitar dependencia circular con main.tsx
// queryClient se inyecta en tiempo de ejecución, no en tiempo de importación.
let _queryClientRef: { clear: () => void } | null = null;
export function injectQueryClient(qc: { clear: () => void }) {
  _queryClientRef = qc;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  activeBranchId: BranchId | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;
  isSubscriptionExpired: boolean;
  error: string | null;
  message: string | null;

  checkAuth: () => Promise<void>;
  login: (emailOrCredentials: string | Record<string, any>, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveBranch: (branchId: BranchId | null) => void;
  clearAuth: () => void;
  setSubscriptionExpired: (status: boolean) => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  createUserByAdmin: (name: string, email: string, password: string) => Promise<any>;
  purgeUser: (targetUserId: string) => Promise<any>;
  updateToken: (token: string) => void;
  
  actions: {
    updateToken: (token: string) => void;
    checkAuth: () => Promise<void>;
    login: (emailOrCredentials: string | Record<string, any>, password?: string) => Promise<void>;
    logout: () => Promise<void>;
    setActiveBranch: (branchId: BranchId | null) => void;
    clearAuth: () => void;
    setSubscriptionExpired: (status: boolean) => void;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (token: string, password: string) => Promise<void>;
    createUserByAdmin: (name: string, email: string, password: string) => Promise<any>;
    purgeUser: (targetUserId: string) => Promise<any>;
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      const actions = {
        updateToken: (token: string) => set({ token }),
        checkAuth: async () => {
          set({ isCheckingAuth: true, error: null });
          try {
            const res = await api.get('/api/auth/check-auth');
            if (res.data.success) {
              set({ 
                user: res.data.user, 
                isAuthenticated: true 
              });
            }
          } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
              const status = error.response?.status;
              if (status === 401 || status === 403) {
                get().clearAuth();
              }
            }
          } finally {
            set({ isCheckingAuth: false });
          }
        },

        login: async (emailOrCredentials: string | Record<string, any>, password?: string) => {
          set({ isLoading: true, error: null });
          try {
            let payload: Record<string, any>;
            if (typeof emailOrCredentials === 'string') {
              payload = { email: emailOrCredentials, password };
            } else {
              payload = emailOrCredentials;
            }
            const res = await api.post('/api/auth/login', payload, {
              headers: {
                'x-global-request': 'true'
              }
            });
            if (res.data.success) {
              set({ 
                user: res.data.user,
                token: res.data.token,
                isAuthenticated: true,
                activeBranchId: null, // Forzar selección de sucursal en cada login
              });
            }
          } catch (error: any) {
            set({ error: error.response?.data?.message || 'Error logging in' });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        logout: async () => {
          set({ isLoading: true, error: null });
          try {
            await api.post('/api/auth/logout');
          } catch {
            // Ignoramos error en logout backend, pero siempre limpiamos localmente
          } finally {
            get().clearAuth();
            if (_queryClientRef) {
              _queryClientRef.clear();
            }
            set({ isLoading: false });
          }
        },

        setActiveBranch: (branchId: BranchId | null) => {
          set({ activeBranchId: branchId });
        },

        clearAuth: () => {
          set({ 
            user: null, 
            token: null,
            activeBranchId: null, 
            isAuthenticated: false,
            isSubscriptionExpired: false,
            error: null,
            message: null
          });
          localStorage.removeItem('auth-storage'); // Purga dura del almacenamiento local
          // Purgar toda la caché de TanStack Query para que los datos del
          // tenant anterior no sean visibles en la próxima sesión.
          _queryClientRef?.clear();
        },

        setSubscriptionExpired: (status: boolean) => {
          set({ isSubscriptionExpired: status });
        },

        forgotPassword: async (email: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.post('/api/auth/forgot-password', { email });
            set({ message: response.data.message });
          } catch (error: any) {
            set({
              error: error.response?.data?.message || "Error sending reset password email",
            });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        resetPassword: async (token: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.post(`/api/auth/reset-password/${token}`, { password });
            set({ message: response.data.message });
          } catch (error: any) {
            set({
              error: error.response?.data?.message || "Error resetting password",
            });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        createUserByAdmin: async (name: string, email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.post('/api/auth/create-user', { name, email, password });
            set({ message: response.data.message });
            return response.data;
          } catch (error: any) {
            set({
              error: error.response?.data?.message || "Error creating user",
            });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        purgeUser: async (targetUserId: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.delete(`/api/auth/purge/${targetUserId}`);
            set({ message: response.data.message });
            return response.data;
          } catch (error: any) {
            set({
              error: error.response?.data?.message || "Error purging user",
            });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        }
      };

      return {
        user: null,
        token: null,
        activeBranchId: null,
        isAuthenticated: false,
        isLoading: false,
        isCheckingAuth: true,
        isSubscriptionExpired: false,
        error: null,
        message: null,

        // Flat actions for backward compatibility
        ...actions,

        // Grouped actions for the new design
        actions
      };
    },
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // 🚨 PUNTO CLAVE DE SEGURIDAD: Solo guardamos el activeBranchId en el navegador.
      // El token de sesión ahora reside en RAM para evitar vulnerabilidades XSS.
      partialize: (state) => ({ 
        activeBranchId: state.activeBranchId,
      }),
    }
  )
);

// Custom hook de alta eficiencia para extraer únicamente los métodos sin causar re-renders innecesarios
export const useAuthActions = () => useAuthStore((state) => state.actions);
