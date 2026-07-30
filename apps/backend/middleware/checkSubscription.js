import { User } from "../models/User.js";
import { redis } from "../lib/redis.js";
import { getCurrentLogger } from "../lib/logger.js";

// ─── CACHÉ DE SUSCRIPCIÓN EN REDIS ─────────────────────────────────────────
// Un Map() en memoria NO persiste entre invocaciones serverless de Vercel.
// Redis sí persiste — el caché funciona correctamente en producción.
const SUB_CACHE_TTL = 5 * 60; // 5 minutos en segundos (TTL para Redis)

export const checkSubscription = async (req, res, next) => {
  try {
    const businessOwnerId = req.businessOwnerId;
    const cacheKey = `sub:${businessOwnerId}`;

    // Verificar caché en Redis primero
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      if (cached === 'expired') {
        return res.status(403).json({
          success: false,
          message: "Tu suscripción de 7 días ha vencido. Por favor, contacta al administrador para renovar."
        });
      }
      return next();
    }

    const user = await User.findById(businessOwnerId).select('subscriptionExpiresAt').lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    if (!user.subscriptionExpiresAt) {
      // Compatibilidad con usuarios anteriores: dejarlos pasar
      await redis.set(cacheKey, 'active', { ex: SUB_CACHE_TTL });
      return next();
    }

    const isExpired = new Date() > user.subscriptionExpiresAt;
    await redis.set(cacheKey, isExpired ? 'expired' : 'active', { ex: SUB_CACHE_TTL });

    if (isExpired) {
      return res.status(403).json({
        success: false,
        message: "Tu suscripción de 7 días ha vencido. Por favor, contacta al administrador para renovar."
      });
    }

    next();
  } catch (error) {
    getCurrentLogger().error({ err: error }, "Error in checkSubscription");
    res.status(500).json({ success: false, message: "Error verificando suscripción" });
  }
};
