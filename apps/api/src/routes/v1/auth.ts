import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { getUserId } from '../../lib/user.js';

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get('/auth/me', async (_req, reply) => {
    const userId = await getUserId();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, createdAt: true },
    });
    return reply.send({ user });
  });
}
