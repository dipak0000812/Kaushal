// FILE: src/modules/student/student.read.routes.js
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  getInternships,
  getInternshipById,
  getMyApplications,
  getWhatsNext,
} from './student.read.controller.js';
import { updateProfile } from './student.write.controller.js';

const router = Router();

// PATCH /api/v1/student/profile — update student's own profile before first application
router.patch('/profile', authenticate, roleGuard(['student']), updateProfile);

// GET /api/v1/student/internships — browse open internships with eligibility badge
router.get('/internships', authenticate, roleGuard(['student']), getInternships);

// GET /api/v1/student/internships/:id — full eligibility breakdown for one posting
router.get('/internships/:id', authenticate, roleGuard(['student']), getInternshipById);

// GET /api/v1/student/applications — own applications with timeline
router.get('/applications', authenticate, roleGuard(['student']), getMyApplications);

// GET /api/v1/student/whats-next — action prompt for home screen
router.get('/whats-next', authenticate, roleGuard(['student']), getWhatsNext);

export default router;
