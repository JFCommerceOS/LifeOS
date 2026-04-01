import type { FastifyInstance } from 'fastify';
import { getUserId } from '../../lib/user.js';
import { getLatestUserState, persistUserStateSnapshot } from '../../services/user-state-service.js';

export async function registerUserStateRoutes(app: FastifyInstance) {
  app.get('/user-state/current', async (_req, reply) => {
    const userId = await getUserId();
    const snapshot = await getLatestUserState(userId);
    return reply.send({ snapshot });
  });

  app.post('/user-state/refresh', async (_req, reply) => {
    const userId = await getUserId();
    const snapshot = await persistUserStateSnapshot(userId);
    return reply.send({ snapshot });
  });
}
