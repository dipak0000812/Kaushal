import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';
import { app } from './app.js';
import { logger } from './core/logger.js';

let server;

async function start() {
  // Connect to MongoDB before accepting any traffic
  await connectDB();

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Kaushal API started');
  });

  server.on('error', (err) => {
    logger.fatal({ err }, 'HTTP server error');
    process.exit(1);
  });
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received — closing gracefully');

  if (server) {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    logger.info('HTTP server closed');
  }

  await disconnectDB();
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Unhandled rejections / exceptions — log and exit; let the process manager restart
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ err }, 'Startup failed');
  process.exit(1);
});
