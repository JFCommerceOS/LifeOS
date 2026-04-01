import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { resolveSecurityContext } from '../../lib/security-context.js';
import { bootstrapIdentity } from '../../services/identity-service.js';

export async function registerIdentityRoutes(app: FastifyInstance) {
  app.post('/identity/bootstrap', async (_req, reply) => {
    const out = await bootstrapIdentity();
    return reply.status(201).send(out);
  });

  app.get('/identity/me', async (req, reply) => {
    const ctx = await resolveSecurityContext(req);
    const [user, settings, sessionCount] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: {
          id: true,
          email: true,
          createdAt: true,
          primaryAuthMethod: true,
          passkeyEnabled: true,
          recoveryState: true,
          lastSecurityReviewAt: true,
        },
      }),
      prisma.userSettings.findUnique({ where: { userId: ctx.userId } }),
      prisma.userSession.count({
        where: { userId: ctx.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);

    return reply.send({
      user,
      activeSessionCount: sessionCount,
      security: settings
        ? {
            healthDomainSurfacePolicy: settings.healthDomainSurfacePolicy,
            financeDomainSurfacePolicy: settings.financeDomainSurfacePolicy,
            watchSensitiveDetailOptIn: settings.watchSensitiveDetailOptIn,
          }
        : null,
      edgeDevice: ctx.edgeDevice,
    });
  });
}
