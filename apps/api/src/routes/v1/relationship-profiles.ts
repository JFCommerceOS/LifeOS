import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const upsertBody = z
  .object({
    personId: z.string().min(1),
    formalityLevel: z.number().int().min(1).max(5).optional(),
    emotionalSensitivity: z.number().int().min(1).max(5).optional(),
    delayTolerance: z.number().int().min(1).max(5).optional(),
    responseExpectation: z.string().optional(),
    tonePreference: z.string().optional(),
    relationshipImportance: z.number().int().min(1).max(5).optional(),
  })
  .strict();

const patchBody = z
  .object({
    formalityLevel: z.number().int().min(1).max(5).optional(),
    emotionalSensitivity: z.number().int().min(1).max(5).optional(),
    delayTolerance: z.number().int().min(1).max(5).optional(),
    responseExpectation: z.string().optional(),
    tonePreference: z.string().optional(),
    relationshipImportance: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export async function registerRelationshipProfileRoutes(app: FastifyInstance) {
  app.get('/relationship-profiles', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.relationshipProfile.count({ where }),
      prisma.relationshipProfile.findMany({
        where,
        include: { person: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/relationship-profiles', async (req, reply) => {
    const userId = await getUserId();
    const body = upsertBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const person = await prisma.person.findFirst({
      where: { id: body.data.personId, userId },
    });
    if (!person) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Person not found' } });
    }
    const profile = await prisma.relationshipProfile.upsert({
      where: { personId: body.data.personId },
      create: {
        userId,
        personId: body.data.personId,
        formalityLevel: body.data.formalityLevel ?? 3,
        emotionalSensitivity: body.data.emotionalSensitivity ?? 3,
        delayTolerance: body.data.delayTolerance ?? 3,
        responseExpectation: body.data.responseExpectation ?? 'normal',
        tonePreference: body.data.tonePreference ?? 'warm',
        relationshipImportance: body.data.relationshipImportance ?? 3,
      },
      update: {
        formalityLevel: body.data.formalityLevel,
        emotionalSensitivity: body.data.emotionalSensitivity,
        delayTolerance: body.data.delayTolerance,
        responseExpectation: body.data.responseExpectation,
        tonePreference: body.data.tonePreference,
        relationshipImportance: body.data.relationshipImportance,
      },
    });
    return reply.status(201).send({ profile });
  });

  app.patch('/relationship-profiles/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = (req.params as { id: string }).id;
    const patch = patchBody.safeParse(req.body);
    if (!patch.success) return reply.status(400).send({ error: patch.error.flatten() });
    const existing = await prisma.relationshipProfile.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    const profile = await prisma.relationshipProfile.update({
      where: { id },
      data: patch.data,
    });
    return reply.send({ profile });
  });
}
