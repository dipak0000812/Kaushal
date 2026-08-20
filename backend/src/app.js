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

// ── API routes (mounted here as modules are implemented) ──────────────────
// app.use(`${API_PREFIX}/auth`, authRoutes);
// app.use(`${API_PREFIX}/student`, studentRoutes);
// app.use(`${API_PREFIX}/company`, companyRoutes);
// app.use(`${API_PREFIX}/faculty`, facultyRoutes);
// app.use(`${API_PREFIX}/tnp`, tnpRoutes);
// app.use(`${API_PREFIX}/hod`, hodRoutes);

// ── 404 and error handling — must be last ─────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export { app };
