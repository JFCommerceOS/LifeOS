import type { FastifyInstance } from 'fastify';
import { buildAdaptivePlanning } from '../../lib/adaptive-planning.js';
import { getUserId } from '../../lib/user.js';

export async function registerPlanningRoutes(app: FastifyInstance) {
  app.get('/planning/adaptive', async (_req, reply) => {
    const userId = await getUserId();
    const payload = await buildAdaptivePlanning(userId);
    return reply.send(payload);
  });
}
