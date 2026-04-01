import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parsePagination } from '../../lib/pagination.js';
import { getUserId } from '../../lib/user.js';
import { buildPaginatedMeta } from '@life-os/shared';

export async function registerHardeningJobRoutes(app: FastifyInstance) {
  app.get('/jobs', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.scheduledJob.count({ where }),
      prisma.scheduledJob.findMany({
        where,
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          runs: { orderBy: { startedAt: 'desc' }, take: 3 },
        },
      }),
    ]);
    return reply.send({
      data,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/jobs/:jobId', async (req, reply) => {
    const userId = await getUserId();
    const jobId = z.string().parse((req.params as { jobId: string }).jobId);
    const job = await prisma.scheduledJob.findFirst({
      where: { id: jobId, userId },
      include: { runs: { orderBy: { startedAt: 'desc' } } },
    });
    if (!job) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ job });
  });

  app.post('/jobs/:jobId/retry', async (req, reply) => {
    const userId = await getUserId();
    const jobId = z.string().parse((req.params as { jobId: string }).jobId);
    const existing = await prisma.scheduledJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const job = await prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        scheduledFor: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      },
    });
    return reply.send({ job });
  });
}
