import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

export async function registerPolicyDecisionRoutes(app: FastifyInstance) {
  app.get('/policy-decisions', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.policyDecision.count({ where }),
      prisma.policyDecision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data,
      meta: buildPaginatedMeta(total, page, pageSize),
    });
  });
}
