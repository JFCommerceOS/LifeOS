import type { FastifyInstance } from 'fastify';
import { buildEcosystemManifest } from '../../lib/ecosystem-manifest.js';
import { getUserId } from '../../lib/user.js';

export async function registerEcosystemRoutes(app: FastifyInstance) {
  app.get('/ecosystem/manifest', async (_req, reply) => {
    const userId = await getUserId();
    const manifest = await buildEcosystemManifest(userId);
    return reply.send(manifest);
  });
}
