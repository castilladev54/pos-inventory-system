import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

// Variables de control fuera del interceptor (Singleton)
let isRefreshing = false;

// Tipado Estricto: resolve devuelve string (token), reject devuelve AxiosError
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: AxiosError) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

type UnauthorizedCallback = () => void;
let onUnauthorizedCb: UnauthorizedCallback | null = null;

export const setOnUnauthorizedCallback = (cb: UnauthorizedCallback) => {
  onUnauthorizedCb = cb;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true, // 🚨 CRUCIAL: Permite el envío automático de cookies HttpOnly
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interceptor de Peticiones: Inyección del Contexto de Sucursal
 */
api.interceptors.request.use(
  (config) => {
    const authState = useAuthStore.getState();
    const activeBranchId = authState.activeBranchId;
    const token = authState.token;
    
    // Si hay una sucursal activa seleccionada y no es una solicitud explícitamente global
    if (activeBranchId && !config.headers['x-global-request']) {
      config.headers['x-branch-id'] = activeBranchId;
    }

    // Inyectar el token Bearer si existe
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Interceptor de Respuestas: Manejo global de expiración y concurrencia
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const status = error.response?.status;

    // 1. Sesión expirada (401) - Patrón Singleton para Refresh
    if (status === 401 && originalRequest.url !== '/api/auth/refresh' && !originalRequest._retry) {
      if (isRefreshing) {
        try {
          const newToken = await new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await api.get('/api/auth/refresh');
        const newToken = res.data.token;
        
        useAuthStore.getState().actions.updateToken(newToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (err) {
        const axiosError = err as AxiosError;
        processQueue(axiosError, null);
        
        // Purgamos la sesión
        useAuthStore.getState().actions.clearAuth();
        
        // Propagar el rechazo para que TanStack Query lo capture
        return Promise.reject(axiosError);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 general o un 401 que falló en el refresh (ej. la ruta original ERA /refresh)
    // Regla de Oro: clearAuth() ignora los 403, permitiendo que lleguen a los componentes o caches
    if (status === 401 && originalRequest.url !== '/api/auth/refresh') {
       useAuthStore.getState().actions.clearAuth();
    }

    // Lock de Suscripción Expirada (Bloqueo global del backend)
    // Delegamos la redirección (idealmente) a la UI, pero si es un hard-lock:
    const errorMessage = (error.response?.data as any)?.message || '';
    if (status === 403 && errorMessage.toLowerCase().includes('suscripción')) {
      // Dejamos esto como caso especial si el negocio lo dicta,
      // pero se recomienda que el ProtectedRoute capture isSubscriptionExpired.
      // Siguiendo las reglas: eliminar manipulaciones de window.location.
      useAuthStore.getState().actions.setSubscriptionExpired(true);
    } 

    return Promise.reject(error);
  }
);

