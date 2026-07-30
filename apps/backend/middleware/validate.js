import { z } from 'zod';

export const validate = (schema) => async (req, res, next) => {
  try {
    await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: (error.errors || error.issues || []).map(err => ({
          field: (err.path || []).join('.'),
          message: err.message
        }))
      });
    }
    next(error);
  }
};
