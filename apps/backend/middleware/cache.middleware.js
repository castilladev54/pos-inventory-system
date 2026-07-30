import { redis } from '../lib/redis.js';
import { getCurrentLogger } from '../lib/logger.js';

/**
 * Middleware para servir y guardar datos en caché usando Upstash Redis.
 * Elimina la responsabilidad del caché de lectura directamente de los controladores.
 *
 * @param {string} prefix        - Prefijo del key de caché (ej. 'products', 'categories')
 * @param {string} dataKey       - Propiedad del JSON de respuesta que contiene la data (ej. 'products')
 * @param {string} [paramKey]    - (Opcional) Parámetro dinámico de la ruta (ej. 'id', 'code')
 * @param {number} [ttl=3600]    - Tiempo de vida en segundos (default: 1 hora)
 */
export const cacheMiddleware = (prefix, dataKey, paramKey = null, ttl = 3600) => {
  return async (req, res, next) => {
    try {
      // Fix #1 — Guard: sin businessOwnerId no se puede construir una key segura.
      // Si la ruta es pública o verifyToken no corrió, saltamos el caché.
      if (!req.businessOwnerId) {
        return next();
      }

      // Construimos la clave dinámica y determinista por usuario
      let key = `${prefix}:`;
      if (paramKey && req.params[paramKey]) {
        key += `${req.params[paramKey]}:`;
      }
      key += req.businessOwnerId;

      // 1. Hit de caché → responder directamente
      const cachedData = await redis.get(key);

      if (cachedData) {
        return res.status(200).json({
          success: true,
          // Fix #2 — Upstash ya deserializa el JSON automáticamente,
          // no hace falta JSON.parse ni el ternario defensivo.
          [dataKey]: cachedData,
          fromCache: true,
        });
      }

      // 2. Miss de caché → interceptar res.json para guardar antes de enviar
      const originalJson = res.json;

      res.json = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300 && body.success && body[dataKey]) {
          // Fix #2 — Guardar el objeto directamente (sin JSON.stringify).
          //           Upstash lo serializa internamente al almacenarlo.
          // Fix #3 — TTL configurable por instancia del middleware.
          redis.set(key, body[dataKey], { ex: ttl })
            .catch(err => getCurrentLogger().error({ err }, 'Redis set error'));

          // Fix #5 — fromCache: false solo en respuestas exitosas
          return originalJson.call(this, { ...body, fromCache: false });
        }

        // Respuestas de error (4xx / 5xx): no contaminar el body con fromCache
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      getCurrentLogger().error({ err: error }, 'Cache Middleware Error');
      // Fail-open: si Redis falla, la petición sigue hacia MongoDB
      next();
    }
  };
};
