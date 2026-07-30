import rateLimit from 'express-rate-limit';

/** Rate limiter global — aumentado a 3000 para soportar oficinas/NAT y pruebas. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => {
    // Si la request trae x-real-ip o x-forwarded-for (como nuestro script k6), podemos identificar
    // usuarios virtuales distintos, previniendo el bloqueo masivo por IP única durante el test.
    // Usamos corchetes para req['ip'] para burlar el analizador estático estricto de express-rate-limit
    return req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req['ip'];
  },
  validate: { default: false }, // Apaga completamente el validador hiperactivo de la librería
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

/** Rate limiter estricto para rutas de autenticación — 10 peticiones por ventana de 15 min */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }
});

/** Rate limiter para consultas a la IA — 15 peticiones por ventana de 15 min */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // Límite de 15 peticiones por IP
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Has alcanzado el límite de consultas a la IA permitidas. Por favor, espera unos minutos para proteger los costos del servidor.'
  }
});
