// FILE: src/modules/analytics/analytics.routes.js
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import { getTnpDashboard, getTnpAlerts, getHodDashboard } from './analytics.controller.js';

const router = Router();

// GET /api/v1/analytics/dashboard — T&P full dashboard
router.get('/dashboard', authenticate, roleGuard(['tnp']), getTnpDashboard);

// GET /api/v1/analytics/alerts — T&P alert counts
router.get('/alerts', authenticate, roleGuard(['tnp']), getTnpAlerts);

// GET /api/v1/analytics/hod — HOD department dashboard
router.get('/hod', authenticate, roleGuard(['hod']), getHodDashboard);

export default router;
