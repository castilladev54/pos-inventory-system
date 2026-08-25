import mongoose from 'mongoose';

/**
 * Evalúa si un error de MongoDB es producto de un conflicto de concurrencia
 * que puede ser resuelto con un reintento.
 */
const isTransientTransactionError = (error: any): boolean => {
  // 1. Error E11000: Duplicate Key.
  // Puede ocurrir si 2 hilos hacen upsert + $setOnInsert exactamente al mismo tiempo
  if (error.code === 11000) return true;
  
  // 2. Errores marcados oficialmente por el driver de MongoDB como transitorios
  if (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) return true;
  
  // 3. Códigos de error específicos de conflicto de escritura en MongoDB
  // 112: WriteConflict
  // 251: NoSuchTransaction
  if (error.code === 112 || error.code === 251) return true;

  return false;
};

/**
 * Función de orden superior que ejecuta una operación y la reintenta
 * automáticamente si detecta conflictos de concurrencia.
 * 
 * @param operation Función asíncrona que encapsula toda la lógica de negocio y su propia sesión
 * @param maxRetries Número máximo de intentos antes de rendirse
 */
export const withTransactionRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let attempt = 1;
  
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (!isTransientTransactionError(error) || attempt >= maxRetries) {
        throw error;
      }
      
      console.warn(`[Transaction Retry] Conflicto de concurrencia detectado (intento ${attempt}/${maxRetries}). Reintentando...`);
      
      attempt++;
      
      // Jitter / Backoff exponencial: 
      // Pausa aleatoria entre 20ms y 100ms * intento para desincronizar los hilos en conflicto
      const backoffMs = Math.floor(Math.random() * 80 + 20) * attempt;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
};
