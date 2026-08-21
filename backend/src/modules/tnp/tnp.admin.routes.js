import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  createInviteHandler,
  provisionFacultyHandler,
  provisionHodHandler,
  provisionUserHandler,
  getUsersHandler,
  getCompaniesHandler,
  verifyCompanyHandler,
  getPendingInternships,
  approveInternship,
  verifyOffer,
  rejectOffer,
  overrideEligibility,
  assignMentor,
  cancelApplication,
  getTnpAlertsHandler,
  getTnpAnalyticsDashboard,
} from './tnp.admin.controller.js';
import { getUnassignedQueue } from './tnp.read.controller.js';

const router = Router();

// Invites & Provisioning
router.post('/invites', authenticate, roleGuard(['tnp']), createInviteHandler);
router.post('/users/faculty', authenticate, roleGuard(['tnp']), provisionFacultyHandler);
router.post('/users/hod', authenticate, roleGuard(['tnp']), provisionHodHandler);
router.post('/users', authenticate, roleGuard(['tnp']), provisionUserHandler);
router.get('/users', authenticate, roleGuard(['tnp']), getUsersHandler);
router.get('/companies', authenticate, roleGuard(['tnp']), getCompaniesHandler);
router.patch('/companies/:id/verify', authenticate, roleGuard(['tnp']), verifyCompanyHandler);

// Internship Approvals
router.get('/internships/pending-approval', authenticate, roleGuard(['tnp']), getPendingInternships);
router.patch('/internships/:id/approve', authenticate, roleGuard(['tnp']), approveInternship);

// Applications & Offers
router.patch('/applications/:id/verify-offer', authenticate, roleGuard(['tnp']), verifyOffer);
router.patch('/applications/:id/reject-offer', authenticate, roleGuard(['tnp']), rejectOffer);
router.patch('/applications/:id/override', authenticate, roleGuard(['tnp']), overrideEligibility);
router.patch('/applications/:id/cancel', authenticate, roleGuard(['tnp']), cancelApplication);

// Mentor Assignments
router.post('/assignments', authenticate, roleGuard(['tnp']), assignMentor);
router.get('/assignments/unassigned', authenticate, roleGuard(['tnp']), getUnassignedQueue);

// Alerts & Analytics Dashboard
router.get('/alerts', authenticate, roleGuard(['tnp']), getTnpAlertsHandler);
router.get('/analytics/dashboard', authenticate, roleGuard(['tnp']), getTnpAnalyticsDashboard);

export default router;
