import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { API_PREFIX } from './core/constants.js';
import { notFound } from './middlewares/not-found.js';
import { errorHandler } from './middlewares/error-handler.js';

import authRoutes from './modules/auth/auth.routes.js';
import riskRoutes from './modules/risk/risk.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import studentReadRoutes from './modules/student/student.read.routes.js';
import studentOffCampusRoutes from './modules/student/student.offcampus.routes.js';
import companyReadRoutes from './modules/company/company.read.routes.js';
import facultyReadRoutes from './modules/faculty/faculty.read.routes.js';
import tnpReadRoutes from './modules/tnp/tnp.read.routes.js';
import tnpAdminRoutes from './modules/tnp/tnp.admin.routes.js';
import tnpOffCampusRoutes from './modules/tnp/tnp.offcampus.routes.js';
import hodRoutes from './modules/hod/hod.routes.js';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);

// ── Parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// ── Request logging ───────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    // Suppress logging for the health endpoint to avoid noise
    autoLogging: { ignore: (req) => req.url === '/health' },
  }),
);

// ── Health endpoint ───────────────────────────────────────────────────────
// Outside API_PREFIX — infrastructure check only, no auth, no business logic
app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, status: 'ok' });
});

// ── API routes (canonical /api/v1 prefix + /api & /auth aliases) ───────────
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/student/off-campus-opportunities', studentOffCampusRoutes);
app.use('/api/student', studentReadRoutes);
app.use('/api/company', companyReadRoutes);
app.use('/api/faculty', facultyReadRoutes);
app.use('/api/tnp/off-campus', tnpOffCampusRoutes);
app.use('/api/tnp/off-campus-opportunities', tnpOffCampusRoutes);
app.use('/api/tnp', tnpAdminRoutes);
app.use('/api/tnp', tnpReadRoutes);
app.use('/api/hod', hodRoutes);

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/risk`, riskRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/student/off-campus-opportunities`, studentOffCampusRoutes);
app.use(`${API_PREFIX}/student`, studentReadRoutes);
app.use(`${API_PREFIX}/company`, companyReadRoutes);
app.use(`${API_PREFIX}/faculty`, facultyReadRoutes);
app.use(`${API_PREFIX}/tnp/off-campus`, tnpOffCampusRoutes);
app.use(`${API_PREFIX}/tnp/off-campus-opportunities`, tnpOffCampusRoutes);
app.use(`${API_PREFIX}/tnp`, tnpAdminRoutes);
app.use(`${API_PREFIX}/tnp`, tnpReadRoutes);
app.use(`${API_PREFIX}/hod`, hodRoutes);

// ── 404 and error handling — must be last ─────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export { app };
