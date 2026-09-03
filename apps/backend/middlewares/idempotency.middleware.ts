import { Request, Response, NextFunction } from 'express';
import { idempotencyHeaderSchema } from '@inventory/shared';
import { redis } from '../lib/redis.js';
import { getCurrentLogger } from '../lib/logger.js';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 horas

/**
 * Middleware que verifica si un request transaccional ya fue procesado o está en proceso,
 * utilizando Redis (SET NX) para implementar un cerrojo distribuido (Distributed Lock).
 */
export const checkIdempotency = async (req: Request | any, res: Response, next: NextFunction) => {
  try {
    const key = req.headers['x-idempotency-key'];

    // Si no hay llave, dejamos pasar (útil si decidimos que la idempotencia es opt-in para ciertos clientes).
    // Para hacerlo estricto, podríamos retornar un 400 Bad Request aquí.
    if (!key) {
      return res.status(400).json({ success: false, message: 'Falta la cabecera x-idempotency-key' });
    }

    // Validación estricta Zod UUID v4
    const parsed = idempotencyHeaderSchema.safeParse(key);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: (parsed as any).error.errors[0].message });
    }

    const userId = req.user ? req.user._id.toString() : 'anonymous';
    const redisKey = `idempotency:${userId}:${key}`;

    // SET NX: Solo se escribe si la llave no existe.
    // Con Upstash, { nx: true } hace un SET if Not eXists de forma atómica.
    const lockAcquired = await redis.set(redisKey, "PROCESSING", { nx: true, ex: IDEMPOTENCY_TTL_SECONDS });

    if (lockAcquired) {
      // Somos los dueños del cerrojo. Anotamos la llave en el req para que el wrapper la persista al final.
      req.idempotencyKey = redisKey;
      return next();
    }

    // Si lockAcquired es nulo, la llave ya existe.
    const existingState = await redis.get(redisKey);

    if (existingState === "PROCESSING") {
      getCurrentLogger().warn({ redisKey }, "Intento concurrente bloqueado por idempotencia");
      return res.status(409).json({
        success: false,
        message: 'La transacción está siendo procesada actualmente. Por favor, espere.'
      });
    }

    // Si no es PROCESSING, es un JSON con el resultado cacheado exitoso previo.
    getCurrentLogger().info({ redisKey }, "Devolviendo respuesta cacheada por idempotencia");
    // Agregamos un header informativo para el cliente
    res.setHeader('X-Idempotent-Replay', 'true');
    // Upstash ya deserializa, así que existingState es un objeto.
    return res.status(200).json(existingState);

  } catch (error) {
    getCurrentLogger().error({ err: error }, "Error en checkIdempotency");
    // Fail-open si cae Redis (o fail-closed según política. Fail-closed previene dobles cobros).
    return res.status(503).json({ success: false, message: 'Servicio de idempotencia temporalmente no disponible.' });
  }
};

/**
 * Higher-Order Function (Wrapper) para el controlador transaccional.
 * Este wrapper inyecta la Fase de Estado, reemplazando el Monkey Patching.
 * Recibe la función del controlador original y la ejecuta.
 * Al terminar con éxito, almacena la respuesta en Redis antes de enviarla.
 */
export const withIdempotency = (controllerFn: any) => {
  return async (req: Request | any, res: Response | any, next: NextFunction) => {
    try {
      // Ejecuta la lógica central del controlador, devolviendo el objeto de respuesta
      const responsePayload = await controllerFn(req, res, next);

      // Si el controlador retornó un objeto y teníamos una llave de idempotencia
      if (responsePayload && req.idempotencyKey) {
        // Persistir la fase de éxito en Redis
        await redis.set(req.idempotencyKey, responsePayload, { ex: IDEMPOTENCY_TTL_SECONDS });
        // Enviar la respuesta
        return res.status(201).json(responsePayload);
      }

      // Si el controlador decidió enviar la respuesta por sí mismo o no hay llave, 
      // esto asume que el controlador ya se encargó. (Menos ideal, pero flexible).
      // En un patrón puramente declarativo, el controlador SOLO debe retornar el JSON,
      // no debe llamar a res.json().

    } catch (error) {
      // Si hubo error, liberamos la llave de idempotencia para permitir reintentos limpios
      if (req.idempotencyKey) {
        await redis.del(req.idempotencyKey).catch(err => getCurrentLogger().error({ err }, "Error borrando lock idempotente"));
      }
      next(error);
    }
  };
};
