import express from 'express';
import { getAIAdvice } from '../controllers/ai.controller.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/ask', aiLimiter, getAIAdvice);

export default router;
