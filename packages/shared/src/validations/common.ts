import { z } from 'zod';
import { Brand, OBJECT_ID_REGEX } from '../types/index.js';

/**
 * Valida un ObjectId de MongoDB y le aplica Nominal Branding estricto.
 */
export const zNominalId = <B extends string>() =>
  z.string()
   .regex(OBJECT_ID_REGEX, 'ID de MongoDB inválido')
   .transform((val) => val as Brand<string, B>);
