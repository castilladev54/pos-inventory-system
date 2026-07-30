# Migración de Autenticación: RAM + Refresh Token (HttpOnly) & Integridad de Sucursales

Este plan arquitectónico definitivo aborda dos frentes críticos de seguridad e integridad, ahora con un rigor absoluto en TypeScript y flujos reactivos puros de React SPA:
1. **Integridad de Datos (Sucursales):** Validación rigurosa del `activeBranchId` persistido contra la fuente de verdad del backend para prevenir accesos fantasma y colapsos de UI en casos límite, aislando la protección en la capa de enrutamiento.
2. **Seguridad (XSS y Concurrencia):** Migración a JWT en memoria (RAM) + Refresh Token en cookie HttpOnly, implementando un patrón Singleton con Cola de Promesas y un *Module Augmentation* para TypeScript nativo puro.
3. **Flujos Reactivos (SPA):** Eliminación total de manipulaciones del DOM (reloads) para redirecciones y manejo defensivo de errores de red para no purgar sesiones por fallos ajenos a la autenticación.

## Matriz de Refactorización Arquitectónica

| Capa | Archivo | Especificación Técnica Obligatoria |
|---|---|---|
| **Backend** | `auth.controller.ts` | Endpoints `/login` y `/refresh` deben retornar el Access Token en el payload JSON y emitir el Refresh Token vía `res.cookie('refreshToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' })`. CORS debe tener `credentials: true`. |
| **Estado (Zustand)** | `authStore.ts` | Remover token de `partialize`. Modificar `checkAuth()`: capturar errores con `unknown`, verificar con `axios.isAxiosError`. Validar que `activeBranchId` persista en la lista actualizada del backend. Purgar sesión solo si el error es 401 o 403. |
| **Red (Axios)** | `axiosClient.ts` | Injectar *Module Augmentation* para `_retry`. Implementar Mutex (`isRefreshing`) y `failedQueue` estrictamente tipada con `AxiosError`. **Regla de oro:** El destructor global de sesión (`clearAuth()`) ignorará los 403, permitiendo que la promesa rechazada fluya hacia los componentes. |
| **Caché Global** | `queryClient.ts` | Configurar `MutationCache` y `QueryCache`. Interceptar errores globales: `if (error.response?.status === 403)` -> disparar Toast de "Permisos insuficientes" (ej. Sonner/React-Hot-Toast). |
| **Enrutamiento** | `ProtectedRoute.tsx` | Lógica de bloqueo reactivo. Si `isAuthenticated === false` -> `<Navigate replace to="/login"/>`. Si `branches.length === 0` (y no tiene rol global) -> `<Navigate replace to="/select-branch"/>`. |

## Secuencia de Ejecución

- **Paso 1: Bloqueo de Infraestructura Backend.** Configura la emisión de la cookie `HttpOnly` y ajusta los cors. Si el backend no envía la cookie, toda la arquitectura del cliente colapsará.
- **Paso 2: Aislamiento en RAM.** Modifica `authStore.ts`. Extrae el token del `localStorage` y blinda el catch de `checkAuth` contra fallos de red.
- **Paso 3: Cola de Promesas.** Reescribe `axiosClient.ts` con el patrón Singleton. Tipa la cola para rechazar estrictamente con `AxiosError` y remueve la redirección por `window.location`.
- **Paso 4: Manejo Global de Errores.** Ve al archivo donde inicializas TanStack Query (`queryClient.ts`) e implementa el `MutationCache` para atrapar los 403 silenciosamente y notificar al usuario.
- **Paso 5: Capa de Seguridad UI.** Interviene el Layout principal o `ProtectedRoute.tsx` para que reaccione a los cambios del `authStore` y maneje los casos límite de sucursales vacías.

## User Review Required

> [!WARNING]
> La matriz de refactorización y la secuencia de ejecución han sido integradas formalmente en este documento rector. Antes de tocar cualquier código (particularmente del lado del frontend, ya que requiero que me otorgues permisos de lectura si esperas que también asista en el Paso 1 de backend), necesito tu validación.

¿Autorizas formalmente el inicio de la secuencia de ejecución detallada en la Matriz?
