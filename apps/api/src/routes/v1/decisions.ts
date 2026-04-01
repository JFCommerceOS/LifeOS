import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { findSimilarDecisions } from '../../lib/decision-similar.js';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z.object({
  title: z.string().min(1),
  rationale: z.string().optional(),
  outcomeNote: z.string().optional(),
  decidedAt: z.string().datetime().optional(),
  topicKey: z.string().optional(),
});

const patchBody = z
  .object({
    title: z.string().min(1).optional(),
    rationale: z.string().nullable().optional(),
    outcomeNote: z.string().nullable().optional(),
    decidedAt: z.string().datetime().optional(),
    topicKey: z.string().nullable().optional(),
  })
  .strict();

export async function registerDecisionRoutes(app: FastifyInstance) {
  app.get('/decisions', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.decisionRecord.count({ where }),
      prisma.decisionRecord.findMany({
        where,
        orderBy: { decidedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/decisions', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const row = await prisma.decisionRecord.create({
      data: {
        userId,
        title: body.data.title,
        rationale: body.data.rationale,
        outcomeNote: body.data.outcomeNote,
        decidedAt: body.data.decidedAt ? new Date(body.data.decidedAt) : undefined,
        topicKey: body.data.topicKey?.trim() || null,
      },
    });
    const similar = await findSimilarDecisions(userId, row.topicKey, row.id);
    await writeAudit(userId, 'decision.create', { entityType: 'DecisionRecord', entityId: row.id });
    return reply.status(201).send({ decision: row, similarPrior: similar });
  });

  app.get('/decisions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const row = await prisma.decisionRecord.findFirst({ where: { id, userId } });
    if (!row) return reply.status(404).send({ error: 'Not found' });
    const similarPrior = await findSimilarDecisions(userId, row.topicKey, row.id);
    return reply.send({ decision: row, similarPrior });
  });

  app.patch('/decisions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.decisionRecord.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const row = await prisma.decisionRecord.update({
      where: { id },
      data: {
        ...body.data,
        decidedAt: body.data.decidedAt ? new Date(body.data.decidedAt) : undefined,
        topicKey:
          body.data.topicKey === undefined
            ? undefined
            : body.data.topicKey === null
              ? null
              : body.data.topicKey.trim() || null,
      },
    });
    const similarPrior = await findSimilarDecisions(userId, row.topicKey, row.id);
    await writeAudit(userId, 'decision.patch', { entityType: 'DecisionRecord', entityId: id });
    return reply.send({ decision: row, similarPrior });
  });

  app.delete('/decisions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.decisionRecord.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.decisionRecord.delete({ where: { id } });
    await writeAudit(userId, 'decision.delete', { entityType: 'DecisionRecord', entityId: id });
    return reply.status(204).send();
  });
}
