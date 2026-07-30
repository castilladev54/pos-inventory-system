import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { injectQueryClient } from './store/authStore';
import { setOnUnauthorizedCallback } from './api/axiosClient';

import { QueryCache, MutationCache } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import axios from 'axios';

const handleGlobalError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) {
      toast.error("Permisos insuficientes para realizar esta acción.", { id: 'global-403' });
    }
  }
};

/**
 * QueryClient Global
 *
 * staleTime: 60s — los datos se consideran frescos durante 1 minuto.
 *   Evita refetches innecesarios al montar/desmontar componentes en el Dashboard.
 *
 * retry: 1 — solo 1 reintento antes de marcar la query como error.
 *   Coherente con el SLA de 1.5s del backend (no queremos acumular reintentos lentos).
 *
 * refetchOnWindowFocus: false — en un POS activo, el operador cambia de ventana
 *   frecuentemente. Refetchear al volver al foco crea ruido visual innecesario.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0, // Las mutaciones nunca se reintentan — evitan duplicar transacciones
    },
  },
});

// Inyectar referencia para que authStore.clearAuth() pueda purgar la caché
injectQueryClient(queryClient);

// Registrar el callback para desacoplar el interceptor de Axios de la instancia de queryClient
setOnUnauthorizedCallback(() => {
  queryClient.clear();
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {/* Devtools solo visible en desarrollo — tree-shaken en producción */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);

