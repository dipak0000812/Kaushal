// FILE: src/modules/tnp/tnp.read.routes.js
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import {
  getVerificationQueue,
  getUnassignedQueue,
  getTnpWhatsNext,
  getAllStudents,
  getAllInternships,
} from './tnp.read.controller.js';

const router = Router();

// GET /api/v1/tnp/verification-queue — accepted applications awaiting T&P verification
router.get('/verification-queue', authenticate, roleGuard(['tnp']), getVerificationQueue);

// GET /api/v1/tnp/unassigned-queue — tnpVerified with no active mentor assignment
router.get('/unassigned-queue', authenticate, roleGuard(['tnp']), getUnassignedQueue);

// GET /api/v1/tnp/whats-next — most urgent alert as action string
router.get('/whats-next', authenticate, roleGuard(['tnp']), getTnpWhatsNext);

// GET /api/v1/tnp/students — all students across all departments
router.get('/students', authenticate, roleGuard(['tnp']), getAllStudents);

// GET /api/v1/tnp/internships — all internships across all companies
router.get('/internships', authenticate, roleGuard(['tnp']), getAllInternships);

export default router;
