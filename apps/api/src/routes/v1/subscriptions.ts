import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z.object({
  name: z.string().min(1),
  provider: z.string().optional(),
  renewalAt: z.string().datetime(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  active: z.boolean().optional(),
});

const patchBody = createBody.partial().strict();

export async function registerSubscriptionRoutes(app: FastifyInstance) {
  app.get('/subscriptions', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        orderBy: { renewalAt: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/subscriptions', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const sub = await prisma.subscription.create({
      data: {
        userId,
        name: body.data.name,
        provider: body.data.provider,
        renewalAt: new Date(body.data.renewalAt),
        amount: body.data.amount,
        currency: body.data.currency ?? 'USD',
        active: body.data.active ?? true,
      },
    });
    await prisma.reminder.create({
      data: {
        userId,
        title: `Renewal: ${body.data.name}`,
        fireAt: new Date(body.data.renewalAt),
      },
    });
    await writeAudit(userId, 'subscription.create', { entityType: 'Subscription', entityId: sub.id });
    return reply.status(201).send({ subscription: sub });
  });

  app.get('/subscriptions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const subscription = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!subscription) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ subscription });
  });

  app.patch('/subscriptions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const data: Record<string, unknown> = {};
    if (body.data.name !== undefined) data.name = body.data.name;
    if (body.data.provider !== undefined) data.provider = body.data.provider;
    if (body.data.renewalAt !== undefined) data.renewalAt = new Date(body.data.renewalAt);
    if (body.data.amount !== undefined) data.amount = body.data.amount;
    if (body.data.currency !== undefined) data.currency = body.data.currency;
    if (body.data.active !== undefined) data.active = body.data.active;
    const subscription = await prisma.subscription.update({ where: { id }, data: data as never });
    await writeAudit(userId, 'subscription.patch', { entityType: 'Subscription', entityId: id });
    return reply.send({ subscription });
  });

  app.delete('/subscriptions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.subscription.delete({ where: { id } });
    await writeAudit(userId, 'subscription.delete', { entityType: 'Subscription', entityId: id });
    return reply.status(204).send();
  });
}
