import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../core/logger.js';

export async function connectDB() {
  await mongoose.connect(env.MONGODB_URI, { dbName: 'kaushal' });
  logger.info({ uri: env.MONGODB_URI }, 'MongoDB connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
