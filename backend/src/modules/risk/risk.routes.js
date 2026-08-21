// FILE: src/modules/risk/risk.routes.js
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import { getRisk, dismissRisk } from './risk.controller.js';

const router = Router();

// GET /api/v1/risk/:applicationId
// Allowed: faculty, tnp — live risk read
router.get('/:applicationId', authenticate, roleGuard(['faculty', 'tnp']), getRisk);

// PATCH /api/v1/risk/:applicationId/dismiss
// Allowed: faculty only — service enforces must be the assigned mentor
router.patch('/:applicationId/dismiss', authenticate, roleGuard(['faculty']), dismissRisk);

export default router;
