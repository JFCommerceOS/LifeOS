import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { createPlaceEventRow } from '../../services/place-event-service.js';

const createBody = z
  .object({
    occurredAt: z.string().datetime(),
    placeLabel: z.string().optional(),
    placeCategory: z.string().optional(),
    durationMinutes: z.number().int().min(0).optional(),
    masked: z.boolean().optional(),
    source: z.string().optional(),
    savedPlaceId: z.string().optional(),
    resolveSavedPlace: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Boolean((b.placeLabel && b.placeLabel.trim()) || b.savedPlaceId), {
    message: 'placeLabel or savedPlaceId required',
  });

export async function registerPlaceEventRoutes(app: FastifyInstance) {
  app.get('/place-events', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.placeEvent.count({ where }),
      prisma.placeEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: pageSize,
        include: { savedPlace: { include: { aliases: true } } },
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/place-events', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    try {
      const row = await createPlaceEventRow({
        userId,
        occurredAt: new Date(body.data.occurredAt),
        placeLabel: body.data.placeLabel ?? '',
        placeCategory: body.data.placeCategory,
        durationMinutes: body.data.durationMinutes,
        masked: body.data.masked,
        source: body.data.source,
        savedPlaceId: body.data.savedPlaceId,
        resolveSavedPlace: body.data.resolveSavedPlace,
      });
      await writeAudit(userId, 'place_event.create', { entityType: 'PlaceEvent', entityId: row.id });
      return reply.status(201).send({ placeEvent: row });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'SAVED_PLACE_NOT_FOUND') {
        return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'Saved place not found' } });
      }
      if (msg === 'PLACE_LABEL_REQUIRED') {
        return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'Place label required' } });
      }
      throw e;
    }
  });

  app.delete('/place-events/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.placeEvent.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.placeEvent.delete({ where: { id } });
    await writeAudit(userId, 'place_event.delete', { entityType: 'PlaceEvent', entityId: id });
    return reply.status(204).send();
  });
}
