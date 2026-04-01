import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z.object({
  title: z.string().min(1),
  fireAt: z.string().datetime(),
});

const patchBody = z
  .object({
    title: z.string().min(1).optional(),
    fireAt: z.string().datetime().optional(),
    sent: z.boolean().optional(),
  })
  .strict();

export async function registerReminderRoutes(app: FastifyInstance) {
  app.get('/reminders', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.reminder.count({ where }),
      prisma.reminder.findMany({
        where,
        orderBy: { fireAt: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/reminders', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const reminder = await prisma.reminder.create({
      data: {
        userId,
        title: body.data.title,
        fireAt: new Date(body.data.fireAt),
      },
    });
    await writeAudit(userId, 'reminder.create', { entityType: 'Reminder', entityId: reminder.id });
    return reply.status(201).send({ reminder });
  });

  app.get('/reminders/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const reminder = await prisma.reminder.findFirst({ where: { id, userId } });
    if (!reminder) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ reminder });
  });

  app.patch('/reminders/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.reminder.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const data: { title?: string; fireAt?: Date; sent?: boolean } = {};
    if (body.data.title !== undefined) data.title = body.data.title;
    if (body.data.fireAt !== undefined) data.fireAt = new Date(body.data.fireAt);
    if (body.data.sent !== undefined) data.sent = body.data.sent;
    const reminder = await prisma.reminder.update({ where: { id }, data });
    await writeAudit(userId, 'reminder.patch', { entityType: 'Reminder', entityId: id });
    return reply.send({ reminder });
  });

  app.delete('/reminders/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.reminder.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.reminder.delete({ where: { id } });
    await writeAudit(userId, 'reminder.delete', { entityType: 'Reminder', entityId: id });
    return reply.status(204).send();
  });
}
