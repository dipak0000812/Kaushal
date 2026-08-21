import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  register,
  registerCompanyHandler,
  loginHandler,
  meHandler,
} from './auth.controller.js';

const router = Router();

// POST /api/v1/auth/register — student self-registration
router.post('/register', register);

// POST /api/v1/auth/register/company — company registration via invite token
router.post('/register/company', registerCompanyHandler);

// POST /api/v1/auth/login — universal login (all roles)
router.post('/login', loginHandler);

// GET /api/v1/auth/me — current user identity + profile
router.get('/me', authenticate, meHandler);

export default router;
