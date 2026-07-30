import { z } from 'zod';
import { 
  createUserBodySchema, 
  loginBodySchema, 
  forgotPasswordBodySchema, 
  resetPasswordBodySchema,
  resetPasswordParamsSchema
} from '@inventory/shared/validations';

export const createUserSchema = z.object({
  body: createUserBodySchema
});

export const loginSchema = z.object({
  body: loginBodySchema
});

export const forgotPasswordSchema = z.object({
  body: forgotPasswordBodySchema
});

export const resetPasswordSchema = z.object({
  params: resetPasswordParamsSchema,
  body: resetPasswordBodySchema
});
