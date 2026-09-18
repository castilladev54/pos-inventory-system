import mongoose from 'mongoose';

type MongoTransactionError = {
  code?: number;
  hasErrorLabel?: (label: string) => boolean;
};

const isTransientTransactionError = (
  error: unknown
): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const mongoError = error as MongoTransactionError;

  if (mongoError.code === 11000) {
    return true;
  }

  if (
    typeof mongoError.hasErrorLabel === 'function' &&
    mongoError.hasErrorLabel('TransientTransactionError')
  ) {
    return true;
  }

  return mongoError.code === 112 || mongoError.code === 251;
};

export const withTransactionRetry = async <T>(
  operation: (session: mongoose.ClientSession) => Promise<T>,
  maxRetries = 3
): Promise<T> => {
  let attempt = 1;

  while (true) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const result = await operation(session);

      await session.commitTransaction();

      return result;
    } catch (error: unknown) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      if (!isTransientTransactionError(error) || attempt >= maxRetries) {
        throw error;
      }

      console.warn(
        `[Transaction Retry] Conflicto de concurrencia detectado ` +
        `(intento ${attempt}/${maxRetries}). Reintentando...`
      );

      attempt++;

      const backoffMs =
        Math.floor(Math.random() * 80 + 20) * attempt;

      await new Promise<void>((resolve) => {
        setTimeout(resolve, backoffMs);
      });
    } finally {
      await session.endSession();
    }
  }
};
