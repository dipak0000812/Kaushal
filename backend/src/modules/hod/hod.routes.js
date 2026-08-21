// FILE: src/modules/hod/hod.routes.js
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import { getDashboard } from './hod.controller.js';

const router = Router();

// GET /api/v1/hod/dashboard — department-scoped analytics
router.get('/dashboard', authenticate, roleGuard(['hod']), getDashboard);

export default router;
