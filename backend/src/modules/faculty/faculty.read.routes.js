import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  getAssignedStudents,
  getStudentProgress,
  getFacultyWhatsNext,
} from './faculty.read.controller.js';
import {
  getMyAssignments,
  acceptAssignment,
  rejectAssignment,
  verifyProgressLog,
} from './faculty.write.controller.js';

const router = Router();

// Mentor Assignments
router.get('/assignments', authenticate, roleGuard(['faculty']), getMyAssignments);
router.patch('/assignments/:id/accept', authenticate, roleGuard(['faculty']), acceptAssignment);
router.patch('/assignments/:id/reject', authenticate, roleGuard(['faculty']), rejectAssignment);

// Assigned Students & Progress
router.get('/assigned-students', authenticate, roleGuard(['faculty']), getAssignedStudents);
router.get('/students', authenticate, roleGuard(['faculty']), getAssignedStudents);
router.get('/applications/:applicationId/progress', authenticate, roleGuard(['faculty']), getStudentProgress);
router.patch('/progress-logs/:id/verify', authenticate, roleGuard(['faculty']), verifyProgressLog);

// Action prompt
router.get('/whats-next', authenticate, roleGuard(['faculty']), getFacultyWhatsNext);

export default router;
