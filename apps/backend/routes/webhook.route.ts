import { Router } from 'express';
import { syncBcvRate } from '../controllers/webhook.controller.js';

const router = Router();

// POST /api/webhooks/bcv-sync
// Endpoint público protegido únicamente a nivel de API Key (x-worker-api-key).
// No requiere JWT de usuario — es llamado por el worker de Render de forma automática.
router.post('/bcv-sync', syncBcvRate);

export default router;
