import { PurgeExecutionMode } from '@prisma/client';
import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { createAndRunPurgeJob } from '../../services/purge-job-service.js';

const purgePostBody = z
  .object({
    scopeType: z.enum(['connector', 'category']),
    scopeId: z.string().nullable().optional(),
    category: z.string().min(1).default('connector_source'),
    executionMode: z.nativeEnum(PurgeExecutionMode),
  })
  .strict();

export async function registerPurgeRoutes(app: FastifyInstance) {
  app.post('/purge', async (req, reply) => {
    const userId = await getUserId();
    const body = purgePostBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const job = await createAndRunPurgeJob(
      userId,
      body.data.scopeType,
      body.data.scopeId ?? null,
      body.data.category,
      body.data.executionMode,
    );
    await writeAudit(userId, 'purge.job', { entityId: job.id });
    return reply.status(201).send({ job });
  });

  app.get('/purge/jobs', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const [total, jobs] = await Promise.all([
      prisma.purgeJob.count({ where: { userId } }),
      prisma.purgeJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data: jobs, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.get('/purge/jobs/:jobId', async (req, reply) => {
    const userId = await getUserId();
    const jobId = z.string().parse((req.params as { jobId: string }).jobId);
    const job = await prisma.purgeJob.findFirst({ where: { id: jobId, userId } });
    if (!job) return reply.status(404).send({ error: { code: 'NOT_FOUND' } });
    return reply.send({ job });
  });
}
