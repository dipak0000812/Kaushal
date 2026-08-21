import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  getVerificationQueue,
  verifyOpportunity,
  rejectOpportunity,
} from './tnp.offcampus.controller.js';

const router = Router();

// GET /api/v1/tnp/off-campus/verification-queue — pending off-campus submissions
router.get('/verification-queue', authenticate, roleGuard(['tnp']), getVerificationQueue);

// PATCH /api/v1/tnp/off-campus-opportunities/:id/verify or /api/v1/tnp/off-campus/opportunities/:id/verify
router.patch('/:id/verify', authenticate, roleGuard(['tnp']), verifyOpportunity);
router.patch('/opportunities/:id/verify', authenticate, roleGuard(['tnp']), verifyOpportunity);

// PATCH /api/v1/tnp/off-campus-opportunities/:id/reject or /api/v1/tnp/off-campus/opportunities/:id/reject
router.patch('/:id/reject', authenticate, roleGuard(['tnp']), rejectOpportunity);
router.patch('/opportunities/:id/reject', authenticate, roleGuard(['tnp']), rejectOpportunity);

export default router;
