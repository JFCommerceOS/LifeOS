import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import type { PlaceSensitivity } from '@prisma/client';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const sensitivitySchema = z.enum(['normal', 'home', 'work', 'private_sensitive']);

const createBody = z
  .object({
    label: z.string().min(1),
    category: z.string().optional(),
    sensitivity: sensitivitySchema.optional(),
    defaultMasked: z.boolean().optional(),
    notes: z.string().optional(),
    aliases: z.array(z.string().min(1)).max(20).optional(),
  })
  .strict();

const patchBody = z
  .object({
    label: z.string().min(1).optional(),
    category: z.string().nullable().optional(),
    sensitivity: sensitivitySchema.optional(),
    defaultMasked: z.boolean().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const aliasBody = z.object({ alias: z.string().min(1) }).strict();

function normAlias(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function registerPlacesRoutes(app: FastifyInstance) {
  app.get('/places/capabilities', async (_req, reply) => {
    const userId = await getUserId();
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    return reply.send({
      mode: 'event_only',
      backgroundTracking: false,
      rawTrailStorage: false,
      locationIntelligenceOptIn: settings?.locationIntelligenceOptIn ?? false,
      patternSignalsOptIn: settings?.patternSignalsOptIn ?? false,
      note: 'Life OS stores place visits as user-confirmed or client-submitted events — no continuous route log by default.',
    });
  });

  app.get('/places', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.savedPlace.count({ where }),
      prisma.savedPlace.findMany({
        where,
        orderBy: { label: 'asc' },
        skip,
        take: pageSize,
        include: { aliases: true, _count: { select: { placeEvents: true } } },
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.get('/places/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const row = await prisma.savedPlace.findFirst({
      where: { id, userId },
      include: { aliases: true, _count: { select: { placeEvents: true } } },
    });
    if (!row) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Place not found' } });
    return reply.send({ place: row });
  });

  app.post('/places', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const sens = (body.data.sensitivity ?? 'normal') as PlaceSensitivity;
    const place = await prisma.$transaction(async (tx) => {
      const p = await tx.savedPlace.create({
        data: {
          userId,
          label: body.data.label.trim(),
          category: body.data.category?.trim() || null,
          sensitivity: sens,
          defaultMasked: body.data.defaultMasked ?? false,
          notes: body.data.notes?.trim() || null,
        },
      });
      const aliases = body.data.aliases ?? [];
      const seen = new Set<string>();
      for (const a of aliases) {
        const key = normAlias(a);
        if (!key.length || seen.has(key)) continue;
        seen.add(key);
        await tx.placeAlias.create({
          data: { savedPlaceId: p.id, alias: key },
        });
      }
      return p;
    });
    const full = await prisma.savedPlace.findFirstOrThrow({
      where: { id: place.id },
      include: { aliases: true },
    });
    await writeAudit(userId, 'saved_place.create', { entityType: 'SavedPlace', entityId: place.id });
    return reply.status(201).send({ place: full });
  });

  app.patch('/places/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.savedPlace.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Place not found' } });
    const data: {
      label?: string;
      category?: string | null;
      sensitivity?: PlaceSensitivity;
      defaultMasked?: boolean;
      notes?: string | null;
    } = {};
    if (body.data.label !== undefined) data.label = body.data.label.trim();
    if (body.data.category !== undefined) data.category = body.data.category?.trim() ?? null;
    if (body.data.sensitivity !== undefined) data.sensitivity = body.data.sensitivity as PlaceSensitivity;
    if (body.data.defaultMasked !== undefined) data.defaultMasked = body.data.defaultMasked;
    if (body.data.notes !== undefined) data.notes = body.data.notes?.trim() ?? null;
    const place = await prisma.savedPlace.update({
      where: { id },
      data,
      include: { aliases: true },
    });
    await writeAudit(userId, 'saved_place.patch', { entityType: 'SavedPlace', entityId: id });
    return reply.send({ place });
  });

  app.delete('/places/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.savedPlace.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Place not found' } });
    await prisma.savedPlace.delete({ where: { id } });
    await writeAudit(userId, 'saved_place.delete', { entityType: 'SavedPlace', entityId: id });
    return reply.status(204).send();
  });

  app.post('/places/:id/aliases', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = aliasBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.savedPlace.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Place not found' } });
    const key = normAlias(body.data.alias);
    if (!key.length) return reply.status(400).send({ error: { message: 'Invalid alias' } });
    const alias = await prisma.placeAlias.create({
      data: { savedPlaceId: id, alias: key },
    });
    await writeAudit(userId, 'saved_place.alias.create', { entityType: 'SavedPlace', entityId: id });
    return reply.status(201).send({ alias });
  });

  app.delete('/places/:id/aliases/:aliasId', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const aliasId = z.string().parse((req.params as { aliasId: string }).aliasId);
    const sp = await prisma.savedPlace.findFirst({ where: { id, userId } });
    if (!sp) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Place not found' } });
    const al = await prisma.placeAlias.findFirst({ where: { id: aliasId, savedPlaceId: id } });
    if (!al) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Alias not found' } });
    await prisma.placeAlias.delete({ where: { id: aliasId } });
    await writeAudit(userId, 'saved_place.alias.delete', { entityType: 'SavedPlace', entityId: id });
    return reply.status(204).send();
  });
}
