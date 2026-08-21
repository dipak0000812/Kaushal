import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  getMyInternships,
  getApplicants,
  getCompanyWhatsNext,
  getCompanyAnalytics,
} from './company.read.controller.js';
import {
  postInternship,
  getInternshipById,
  updateInternshipCriteria,
  closeInternship,
  shortlistApplicant,
  rejectApplicant,
  offerApplicant,
  evaluateApplication,
} from './company.write.controller.js';

const router = Router();

// Internship Postings
router.post('/internships', authenticate, roleGuard(['company']), postInternship);
router.get('/internships', authenticate, roleGuard(['company']), getMyInternships);
router.get('/internships/:id', authenticate, roleGuard(['company']), getInternshipById);
router.patch('/internships/:id', authenticate, roleGuard(['company']), updateInternshipCriteria);
router.patch('/internships/:id/close', authenticate, roleGuard(['company']), closeInternship);

// Applicants & Pipeline
router.get('/internships/:id/applicants', authenticate, roleGuard(['company']), getApplicants);
router.patch('/applications/:id/shortlist', authenticate, roleGuard(['company']), shortlistApplicant);
router.patch('/applications/:id/reject', authenticate, roleGuard(['company']), rejectApplicant);
router.patch('/applications/:id/offer', authenticate, roleGuard(['company']), offerApplicant);
router.post('/applications/:id/evaluate', authenticate, roleGuard(['company']), evaluateApplication);

// Action prompt & Analytics
router.get('/whats-next', authenticate, roleGuard(['company']), getCompanyWhatsNext);
router.get('/analytics', authenticate, roleGuard(['company']), getCompanyAnalytics);

export default router;
