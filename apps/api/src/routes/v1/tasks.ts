import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { buildCapturePipelinePayload } from '../../lib/ingest-response.js';
import { captureTaskCreated } from '../../services/capture-pipeline.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z.object({
  title: z.string().min(1),
  done: z.boolean().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  locationHint: z.string().nullable().optional(),
});

const patchBody = z
  .object({
    title: z.string().min(1).optional(),
    done: z.boolean().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    locationHint: z.string().nullable().optional(),
  })
  .strict();

export async function registerTaskRoutes(app: FastifyInstance) {
  app.get('/tasks', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId, archivedAt: null };
    const [total, data] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/tasks', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const row = await prisma.task.create({
      data: {
        userId,
        title: body.data.title,
        done: body.data.done ?? false,
        dueAt: body.data.dueAt === undefined ? undefined : body.data.dueAt ? new Date(body.data.dueAt) : null,
        locationHint:
          body.data.locationHint === undefined
            ? undefined
            : body.data.locationHint === null
              ? null
              : body.data.locationHint.trim() || null,
      },
    });
    const signal = await captureTaskCreated(userId, row);
    await writeAudit(userId, 'task.create', { entityType: 'Task', entityId: row.id });
    const pipeline = await buildCapturePipelinePayload({ task: row }, signal);
    return reply.status(201).send(pipeline);
  });

  app.patch('/tasks/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const row = await prisma.task.update({
      where: { id },
      data: {
        ...body.data,
        dueAt:
          body.data.dueAt === undefined
            ? undefined
            : body.data.dueAt === null
              ? null
              : new Date(body.data.dueAt),
        locationHint:
          body.data.locationHint === undefined
            ? undefined
            : body.data.locationHint === null
              ? null
              : body.data.locationHint.trim() || null,
      },
    });
    await writeAudit(userId, 'task.patch', { entityType: 'Task', entityId: id });
    return reply.send({ task: row });
  });

  app.delete('/tasks/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.task.delete({ where: { id } });
    await writeAudit(userId, 'task.delete', { entityType: 'Task', entityId: id });
    return reply.status(204).send();
  });
}
