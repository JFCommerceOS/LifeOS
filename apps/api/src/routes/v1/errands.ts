import type { FastifyInstance } from 'fastify';
import { buildErrandGroups, buildErrandWindow } from '../../lib/phase5-errands.js';
import { getUserId } from '../../lib/user.js';

export async function registerErrandRoutes(app: FastifyInstance) {
  app.get('/errands/groups', async (_req, reply) => {
    const userId = await getUserId();
    const payload = await buildErrandGroups(userId);
    return reply.send(payload);
  });

  app.get('/errands/window', async (_req, reply) => {
    const userId = await getUserId();
    const payload = await buildErrandWindow(userId);
    return reply.send(payload);
  });
}
