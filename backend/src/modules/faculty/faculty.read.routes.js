// FILE: src/modules/faculty/faculty.read.routes.js
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  getAssignedStudents,
  getStudentProgress,
  getFacultyWhatsNext,
} from './faculty.read.controller.js';

const router = Router();

// GET /api/v1/faculty/assigned-students — own assigned students with live risk
router.get('/assigned-students', authenticate, roleGuard(['faculty']), getAssignedStudents);

// GET /api/v1/faculty/applications/:applicationId/progress — progress logs (assignment gated)
router.get('/applications/:applicationId/progress', authenticate, roleGuard(['faculty']), getStudentProgress);

// GET /api/v1/faculty/whats-next — action prompt
router.get('/whats-next', authenticate, roleGuard(['faculty']), getFacultyWhatsNext);

export default router;
