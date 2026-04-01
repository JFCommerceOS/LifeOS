import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { buildCapturePipelinePayload } from '../../lib/ingest-response.js';
import { captureEventCreated } from '../../services/capture-pipeline.js';
import { runCtxAfterEventCreated } from '../../services/ctx-capture-hooks.js';

const createBody = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function registerEventRoutes(app: FastifyInstance) {
  app.get('/events', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId, archivedAt: null };
    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data: events,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/events/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const event = await prisma.event.findFirst({ where: { id, userId } });
    if (!event) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ event });
  });

  app.post('/events', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const event = await prisma.event.create({
      data: {
        userId,
        title: body.data.title,
        description: body.data.description ?? undefined,
        startsAt:
          body.data.startsAt === undefined ? undefined : body.data.startsAt ? new Date(body.data.startsAt) : null,
        endsAt: body.data.endsAt === undefined ? undefined : body.data.endsAt ? new Date(body.data.endsAt) : null,
      },
    });

    const signal = await captureEventCreated(userId, {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      description: event.description,
    });

    await writeAudit(userId, 'event.create', { entityType: 'Event', entityId: event.id });
    await runCtxAfterEventCreated(userId, { id: event.id, title: event.title });
    const pipeline = await buildCapturePipelinePayload({ event }, signal);
    return reply.status(201).send(pipeline);
  });
}
