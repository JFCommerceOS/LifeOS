import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolveSecurityContext } from '../../lib/security-context.js';
import { listSessionsForUser, revokeSession } from '../../services/session-service.js';

const revokeBody = z.object({ sessionId: z.string().min(1) }).strict();

export async function registerSessionsRoutes(app: FastifyInstance) {
  app.get('/sessions', async (req, reply) => {
    const ctx = await resolveSecurityContext(req);
    const sessions = await listSessionsForUser(ctx.userId);
    return reply.send({ data: sessions });
  });

  app.post('/sessions/revoke', async (req, reply) => {
    const body = revokeBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const ctx = await resolveSecurityContext(req);
    const ok = await revokeSession(ctx.userId, body.data.sessionId);
    if (!ok) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    return reply.send({ ok: true });
  });
}
