import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parsePagination } from '../../lib/pagination.js';
import { getUserId } from '../../lib/user.js';
import { buildPaginatedMeta } from '@life-os/shared';

const reviewBody = z
  .object({
    resolutionNote: z.string().max(2000).optional(),
    humanReviewed: z.boolean().optional(),
  })
  .strict();

export async function registerHardeningConflictRoutes(app: FastifyInstance) {
  app.get('/conflicts', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.conflictEvent.count({ where }),
      prisma.conflictEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/conflicts/:conflictId', async (req, reply) => {
    const userId = await getUserId();
    const conflictId = z.string().parse((req.params as { conflictId: string }).conflictId);
    const row = await prisma.conflictEvent.findFirst({
      where: { id: conflictId, userId },
    });
    if (!row) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ conflict: row });
  });

  app.post('/conflicts/:conflictId/review', async (req, reply) => {
    const userId = await getUserId();
    const conflictId = z.string().parse((req.params as { conflictId: string }).conflictId);
    const body = reviewBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.conflictEvent.findFirst({
      where: { id: conflictId, userId },
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const mergedSummary = body.data.resolutionNote
      ? `${existing.resolutionSummary} | review: ${body.data.resolutionNote}`
      : existing.resolutionSummary;
    const updated = await prisma.conflictEvent.update({
      where: { id: conflictId },
      data: {
        resolutionSummary: mergedSummary,
        humanReviewRequired: body.data.humanReviewed === true ? false : existing.humanReviewRequired,
      },
    });
    return reply.send({ conflict: updated });
  });
}
