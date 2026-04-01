import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z.object({
  title: z.string().min(1),
  startsAt: z.string().datetime(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const patchBody = createBody.partial().strict();

export async function registerLifeAppointmentRoutes(app: FastifyInstance) {
  app.get('/life-appointments', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.lifeAppointment.count({ where }),
      prisma.lifeAppointment.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/life-appointments', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const startsAt = new Date(body.data.startsAt);
    const appt = await prisma.$transaction(async (tx) => {
      const a = await tx.lifeAppointment.create({
        data: {
          userId,
          title: body.data.title,
          startsAt,
          location: body.data.location ?? null,
          notes: body.data.notes ?? null,
        },
      });
      await tx.reminder.create({
        data: {
          userId,
          title: `Appointment: ${body.data.title}`,
          fireAt: startsAt,
        },
      });
      return a;
    });
    await writeAudit(userId, 'life_appointment.create', {
      entityType: 'LifeAppointment',
      entityId: appt.id,
    });
    return reply.status(201).send({ appointment: appt });
  });

  app.get('/life-appointments/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const appointment = await prisma.lifeAppointment.findFirst({ where: { id, userId } });
    if (!appointment) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ appointment });
  });

  app.patch('/life-appointments/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.lifeAppointment.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const data: Record<string, unknown> = {};
    if (body.data.title !== undefined) data.title = body.data.title;
    if (body.data.startsAt !== undefined) data.startsAt = new Date(body.data.startsAt);
    if (body.data.location !== undefined) data.location = body.data.location;
    if (body.data.notes !== undefined) data.notes = body.data.notes;
    const appointment = await prisma.lifeAppointment.update({ where: { id }, data: data as never });
    await writeAudit(userId, 'life_appointment.patch', { entityType: 'LifeAppointment', entityId: id });
    return reply.send({ appointment });
  });

  app.delete('/life-appointments/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.lifeAppointment.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.lifeAppointment.delete({ where: { id } });
    await writeAudit(userId, 'life_appointment.delete', { entityType: 'LifeAppointment', entityId: id });
    return reply.status(204).send();
  });
}
