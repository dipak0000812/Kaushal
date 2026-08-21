// FILE: src/modules/company/company.read.routes.js
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  getMyInternships,
  getApplicants,
  getCompanyWhatsNext,
  getCompanyAnalytics,
} from './company.read.controller.js';

const router = Router();

// GET /api/v1/company/internships — company's own postings
router.get('/internships', authenticate, roleGuard(['company']), getMyInternships);

// GET /api/v1/company/internships/:id/applicants — tiered applicant list
router.get('/internships/:id/applicants', authenticate, roleGuard(['company']), getApplicants);

// GET /api/v1/company/whats-next — action prompt
router.get('/whats-next', authenticate, roleGuard(['company']), getCompanyWhatsNext);

// GET /api/v1/company/analytics — funnel stats for company's postings
router.get('/analytics', authenticate, roleGuard(['company']), getCompanyAnalytics);

export default router;
