import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  getInternships,
  getInternshipById,
  getMyApplications,
  getWhatsNext,
} from './student.read.controller.js';
import {
  getProfile,
  updateProfile,
  applyToInternship,
  acceptOfferHandler,
  declineOfferHandler,
  submitProgressLog,
  getRecommendations,
} from './student.write.controller.js';

const router = Router();

// Student Profile
router.get('/profile', authenticate, roleGuard(['student']), getProfile);
router.patch('/profile', authenticate, roleGuard(['student']), updateProfile);

// Internships & Recommendations
router.get('/internships', authenticate, roleGuard(['student']), getInternships);
router.get('/internships/:id', authenticate, roleGuard(['student']), getInternshipById);
router.get('/recommendations', authenticate, roleGuard(['student']), getRecommendations);

// Applications Lifecycle
router.post('/applications', authenticate, roleGuard(['student']), applyToInternship);
router.get('/applications', authenticate, roleGuard(['student']), getMyApplications);
router.patch('/applications/:id/accept', authenticate, roleGuard(['student']), acceptOfferHandler);
router.patch('/applications/:id/decline', authenticate, roleGuard(['student']), declineOfferHandler);
router.post('/applications/:id/progress-logs', authenticate, roleGuard(['student']), submitProgressLog);

// Action prompt
router.get('/whats-next', authenticate, roleGuard(['student']), getWhatsNext);

export default router;
