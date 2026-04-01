import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { LifePhaseTransitionType } from '@prisma/client';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z
  .object({
    transitionType: z.nativeEnum(LifePhaseTransitionType),
    confidence: z.number().min(0).max(1).optional(),
    summary: z.string().optional(),
    detectedFromJson: z.string().optional(),
    active: z.boolean().optional(),
  })
  .strict();

const patchBody = z
  .object({
    active: z.boolean().optional(),
    summary: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export async function registerLifePhaseRoutes(app: FastifyInstance) {
  app.get('/life-phase-transitions', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.lifePhaseTransition.count({ where }),
      prisma.lifePhaseTransition.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/life-phase-transitions', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const d = body.data;
    const row = await prisma.lifePhaseTransition.create({
      data: {
        userId,
        transitionType: d.transitionType,
        confidence: d.confidence ?? 0.5,
        summary: d.summary,
        detectedFromJson: d.detectedFromJson ?? '{}',
        active: d.active ?? true,
      },
    });
    return reply.status(201).send({ lifePhaseTransition: row });
  });

  app.patch('/life-phase-transitions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = (req.params as { id: string }).id;
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.lifePhaseTransition.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    const lifePhaseTransition = await prisma.lifePhaseTransition.update({
      where: { id },
      data: body.data,
    });
    return reply.send({ lifePhaseTransition });
  });
}
