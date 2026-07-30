import { Types } from 'mongoose';

/**
 * Valida que un string sea un ObjectId válido de MongoDB (24 caracteres hex).
 * Usar antes de cualquier .findOne() / .findById() que reciba un param de URL,
 * para evitar que Mongoose lance un CastError → 500.
 */
export const isValidObjectId = (id: string): boolean =>
  Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id;
