import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  createInviteHandler,
  provisionFacultyHandler,
  provisionHodHandler,
  verifyCompanyHandler,
} from './tnp.admin.controller.js';

const router = Router();

// POST /api/v1/tnp/invites — generate company invite token
router.post('/invites', authenticate, roleGuard(['tnp']), createInviteHandler);

// POST /api/v1/tnp/users/faculty — provision faculty account
router.post('/users/faculty', authenticate, roleGuard(['tnp']), provisionFacultyHandler);

// POST /api/v1/tnp/users/hod — provision HOD account
router.post('/users/hod', authenticate, roleGuard(['tnp']), provisionHodHandler);

// PATCH /api/v1/tnp/companies/:id/verify — verify company (delegates to verifyCompany service)
router.patch('/companies/:id/verify', authenticate, roleGuard(['tnp']), verifyCompanyHandler);

export default router;
