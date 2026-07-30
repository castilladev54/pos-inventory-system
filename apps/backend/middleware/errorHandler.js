import { getCurrentLogger } from "../lib/logger.js";

/**
 * Error Handler Global Centralizado para Express 5.x
 * Express 5 delega automáticamente los rejections de Promise a este middleware.
 */
export const errorHandler = (err, req, res, next) => {
    getCurrentLogger().error({ err }, `[Error] ${err.name}: ${err.message}`);
    
    // Si la respuesta ya fue enviada, delegar al manejador por defecto de Express
    if (res.headersSent) {
      return next(err);
    }
  
    // Mapeo automático de códigos de estado según el tipo de error
    let statusCode = err.status || 500;
  
    // Errores comunes de Mongoose / Logica
    if (err.name === 'ValidationError') statusCode = 400;
    if (err.name === 'CastError') statusCode = 400;
    if (err.code === 11000) statusCode = 409; // Duplicate key
    
    // Captura de errores personalizados (por ej. falta de stock, etc)
    if (err.message && (err.message.includes('Stock') || err.message.toLowerCase().includes('no encontrado'))) {
        statusCode = 400;
    }
  
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Internal Server Error',
      // Incluir el stack trace solo en entorno de desarrollo
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  };
