import type { FastifyInstance } from 'fastify';
import { registerV1 } from './v1/index.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(registerV1, { prefix: '/api/v1' });
}
