import './env.js';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { registerErrorHandlers } from './lib/errors.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
          : undefined,
    },
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: {
      fileSize: 15 * 1024 * 1024,
      files: 2,
      fields: 12,
      parts: 24,
    },
  });

  app.get('/health', async () => ({ ok: true }));

  await registerRoutes(app);

  registerErrorHandlers(app);

  return app;
}
