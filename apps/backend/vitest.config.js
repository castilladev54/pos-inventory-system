import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Setup global: garantiza JWT_SECRET, NODE_ENV=test y carga dotenv
    // ANTES de que cualquier archivo de prueba ejecute su primer import.
    setupFiles: ['./tests/setup.js'],
    // Deshabilitar el paralelismo de archivos para que se ejecuten uno por uno.
    // Esto es crítico porque mongodb-memory-server no puede levantar
    // múltiples instancias en paralelo sin ahogar la CPU/RAM,
    // lo que causa timeouts misteriosos en CI/CD.
    fileParallelism: false,
    // 15s por test individual (CI es más lento que local)
    testTimeout: 15000,
    // 120s para beforeAll/afterAll (MongoMemoryReplSet tarda en arrancar)
    hookTimeout: 120000,
    // Configuración global para mongodb-memory-server
    env: {
      MONGOMS_INSTANCE_STARTUP_TIMEOUT: '60000',
    },
  },
});
