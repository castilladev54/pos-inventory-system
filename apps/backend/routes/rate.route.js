import express from 'express';
import { setDailyRate, getDailyRate, getRateHistory } from '../controllers/rate.controller.js';
import { validate } from '../middleware/validate.js';
import { rateSchema } from '../validations/rate.validation.js';

const router = express.Router();

router.get('/today', getDailyRate);
router.get('/history', getRateHistory);
router.post('/', validate(rateSchema), setDailyRate);

export default router;
