import type { ImportanceLevel, PersonCorrectionType, PersonType } from '@prisma/client';
import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { persistPersonContextBundle } from '../../services/context-bundle-service.js';
import { recordPersonCorrection } from '../../services/person-correction-service.js';

const createBody = z.object({
  name: z.string().min(1),
  relationshipType: z.string().min(1).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  personType: z.enum(['INDIVIDUAL', 'ORGANIZATION', 'GROUP', 'UNKNOWN']).optional(),
  importanceLevel: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  notesSummary: z.string().max(4000).optional().nullable(),
});

const patchBody = z
  .object({
    name: z.string().min(1).optional(),
    relationshipType: z.string().min(1).optional(),
    importance: z.number().int().min(1).max(5).optional(),
    personType: z.enum(['INDIVIDUAL', 'ORGANIZATION', 'GROUP', 'UNKNOWN']).optional(),
    importanceLevel: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
    notesSummary: z.string().max(4000).optional().nullable(),
    lastInteractionAt: z.string().datetime().nullable().optional(),
  })
  .strict();

const correctBody = z.object({
  correctionType: z.enum([
    'WRONG_PERSON_MATCH',
    'MERGE_PEOPLE',
    'SPLIT_PERSON',
    'RENAME_PERSON',
    'CHANGE_IMPORTANCE',
  ]),
  correctionNote: z.string().max(4000).optional().default(''),
});

export async function registerPersonRoutes(app: FastifyInstance) {
  app.get('/persons', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, persons] = await Promise.all([
      prisma.person.count({ where }),
      prisma.person.findMany({
        where,
        orderBy: [{ importance: 'desc' }, { name: 'asc' }],
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data: persons,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.post('/persons', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const person = await prisma.person.create({
      data: {
        userId,
        name: body.data.name,
        relationshipType: body.data.relationshipType ?? 'contact',
        importance: body.data.importance ?? 3,
        personType: (body.data.personType ?? 'INDIVIDUAL') as PersonType,
        importanceLevel: (body.data.importanceLevel ?? 'NORMAL') as ImportanceLevel,
        notesSummary: body.data.notesSummary ?? undefined,
      },
    });
    await prisma.personAlias.create({
      data: {
        personId: person.id,
        aliasText: body.data.name.trim().slice(0, 200),
        sourceType: 'manual',
      },
    });
    await writeAudit(userId, 'person.create', { entityType: 'Person', entityId: person.id });
    return reply.status(201).send({ person });
  });

  app.get('/persons/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const person = await prisma.person.findFirst({
      where: { id, userId },
      include: { aliases: { orderBy: { createdAt: 'desc' } } },
    });
    if (!person) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ person });
  });

  app.patch('/persons/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.person.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const data: {
      name?: string;
      relationshipType?: string;
      importance?: number;
      personType?: PersonType;
      importanceLevel?: ImportanceLevel;
      notesSummary?: string | null;
      lastInteractionAt?: Date | null;
    } = {};
    if (body.data.name !== undefined) data.name = body.data.name;
    if (body.data.relationshipType !== undefined) data.relationshipType = body.data.relationshipType;
    if (body.data.importance !== undefined) data.importance = body.data.importance;
    if (body.data.personType !== undefined) data.personType = body.data.personType as PersonType;
    if (body.data.importanceLevel !== undefined) data.importanceLevel = body.data.importanceLevel as ImportanceLevel;
    if (body.data.notesSummary !== undefined) data.notesSummary = body.data.notesSummary;
    if (body.data.lastInteractionAt !== undefined) {
      data.lastInteractionAt = body.data.lastInteractionAt ? new Date(body.data.lastInteractionAt) : null;
    }
    const person = await prisma.person.update({ where: { id }, data });
    await writeAudit(userId, 'person.patch', { entityType: 'Person', entityId: id, meta: body.data });
    try {
      await persistPersonContextBundle(userId, id);
    } catch {
      /* non-fatal */
    }
    return reply.send({ person });
  });

  app.post('/persons/:id/correct', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = correctBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.person.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    const row = await recordPersonCorrection(
      userId,
      id,
      body.data.correctionType as PersonCorrectionType,
      body.data.correctionNote ?? '',
    );
    await writeAudit(userId, 'person.correct', {
      entityType: 'Person',
      entityId: id,
      meta: { correctionType: body.data.correctionType },
    });
    try {
      await persistPersonContextBundle(userId, id);
    } catch {
      /* non-fatal */
    }
    return reply.status(201).send({ correction: row });
  });
}
