import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { RoutineGoalDomain } from '@prisma/client';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z
  .object({
    title: z.string().min(1),
    goalDomain: z.nativeEnum(RoutineGoalDomain).optional(),
    structureType: z.string().optional(),
    cadence: z.string().optional(),
    triggerDefinition: z.string().optional(),
    minimumSuccessDefinition: z.string().optional(),
    recoveryRule: z.string().optional(),
    active: z.boolean().optional(),
  })
  .strict();

const patchBody = z
  .object({
    title: z.string().min(1).optional(),
    goalDomain: z.nativeEnum(RoutineGoalDomain).optional(),
    structureType: z.string().optional(),
    cadence: z.string().nullable().optional(),
    triggerDefinition: z.string().optional(),
    minimumSuccessDefinition: z.string().optional(),
    recoveryRule: z.string().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export async function registerRoutineScaffoldRoutes(app: FastifyInstance) {
  app.get('/routine-scaffolds', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.routineScaffold.count({ where }),
      prisma.routineScaffold.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/routine-scaffolds', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const d = body.data;
    const routineScaffold = await prisma.routineScaffold.create({
      data: {
        userId,
        title: d.title,
        goalDomain: d.goalDomain ?? 'other',
        structureType: d.structureType ?? 'weekly_rhythm',
        cadence: d.cadence,
        triggerDefinition: d.triggerDefinition ?? '{}',
        minimumSuccessDefinition: d.minimumSuccessDefinition ?? '{}',
        recoveryRule: d.recoveryRule ?? '{}',
        active: d.active ?? true,
      },
    });
    return reply.status(201).send({ routineScaffold });
  });

  app.patch('/routine-scaffolds/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = (req.params as { id: string }).id;
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.routineScaffold.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    const routineScaffold = await prisma.routineScaffold.update({
      where: { id },
      data: body.data,
    });
    return reply.send({ routineScaffold });
  });
}
