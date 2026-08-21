import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  submitOpportunity,
  getMyOpportunities,
} from './student.offcampus.controller.js';

const router = Router();

// POST /api/v1/student/off-campus-opportunities — register externally secured opportunity
router.post('/', authenticate, roleGuard(['student']), submitOpportunity);

// GET /api/v1/student/off-campus-opportunities — get own submitted opportunities
router.get('/', authenticate, roleGuard(['student']), getMyOpportunities);

export default router;
