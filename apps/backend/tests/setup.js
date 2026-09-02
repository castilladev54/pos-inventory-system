import 'dotenv/config';
import { vi } from 'vitest';

// Garantía de aislamiento: forzar entorno de prueba
process.env.NODE_ENV = 'test';

// JWT_SECRET: si no está en .env.test, inyectar un valor determinista
// para que todos los tokens firmados en memoria sean verificables.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_vitest_suite';

// Verificación de fallo rápido: si tras el fallback sigue sin estar definido,
// hay un problema de configuración grave que hay que resolver antes de correr tests.
if (!process.env.JWT_SECRET) {
  throw new Error(
    'Error crítico: La suite de Vitest no puede iniciar sin un JWT_SECRET configurado.'
  );
}

// Mock global de Redis y sus utilidades para evitar dependencias de red en los tests
const store = new Map();
vi.mock('../lib/redis.js', () => {
  return {
    redis: {
      get: async (key) => store.get(key) ?? null,
      set: async (key, val, options) => {
        store.set(key, val);
        return 'OK';
      },
      del: async (...keys) => {
        let count = 0;
        keys.forEach(k => {
          if (store.delete(k)) count++;
        });
        return count;
      },
      incr: async (key) => {
        const val = parseInt(store.get(key) || '0', 10) + 1;
        store.set(key, String(val));
        return val;
      }
    },
    getOrSetCache: async (key, fn) => {
      // Ejecución directa de la consulta para aislar lógica del caché
      const freshData = await fn();
      return { data: freshData, fromCache: false };
    },
    invalidateCache: async (...keys) => {
      keys.forEach(k => store.delete(k));
    },
    getCacheVersion: async (prefix, userId) => {
      const version = store.get(`v:${prefix}:${userId}`);
      return version ? parseInt(version, 10) : 0;
    },
    bumpCacheVersion: async (prefix, userId) => {
      const current = parseInt(store.get(`v:${prefix}:${userId}`) || '0', 10);
      store.set(`v:${prefix}:${userId}`, String(current + 1));
    },
    bumpBranchCacheVersion: async (prefix, ownerId, branchId) => {
      const key = `v:${prefix}:${ownerId}:${branchId}`;
      const current = parseInt(store.get(key) || '0', 10);
      store.set(key, String(current + 1));
    },
    buildPaginatedKey: (prefix, version, page, limit, userId) => {
      return `${prefix}:v${version}:p${page}:l${limit}:${userId}`;
    }
  };
});
