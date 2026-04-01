import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z.object({
  title: z.string().min(1),
  merchant: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  purchasedAt: z.string().datetime(),
  returnWindowEndsAt: z.string().datetime().nullable().optional(),
  receiptRef: z.string().optional(),
});

const patchBody = createBody.partial().extend({ title: z.string().min(1).optional() }).strict();

export async function registerPurchaseRoutes(app: FastifyInstance) {
  app.get('/purchases', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        orderBy: { purchasedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/purchases', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const purchasedAt = new Date(body.data.purchasedAt);
    const returnWindowEndsAt = body.data.returnWindowEndsAt
      ? new Date(body.data.returnWindowEndsAt)
      : null;

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          userId,
          title: body.data.title,
          merchant: body.data.merchant,
          amount: body.data.amount,
          currency: body.data.currency ?? 'USD',
          purchasedAt,
          returnWindowEndsAt,
          receiptRef: body.data.receiptRef,
        },
      });
      if (returnWindowEndsAt) {
        await tx.reminder.create({
          data: {
            userId,
            title: `Return window ends: ${body.data.title}`,
            fireAt: returnWindowEndsAt,
          },
        });
      }
      return p;
    });

    await writeAudit(userId, 'purchase.create', { entityType: 'Purchase', entityId: purchase.id });
    return reply.status(201).send({ purchase });
  });

  app.get('/purchases/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const purchase = await prisma.purchase.findFirst({ where: { id, userId } });
    if (!purchase) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ purchase });
  });

  app.patch('/purchases/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.purchase.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const data: Record<string, unknown> = {};
    if (body.data.title !== undefined) data.title = body.data.title;
    if (body.data.merchant !== undefined) data.merchant = body.data.merchant;
    if (body.data.amount !== undefined) data.amount = body.data.amount;
    if (body.data.currency !== undefined) data.currency = body.data.currency;
    if (body.data.purchasedAt !== undefined) data.purchasedAt = new Date(body.data.purchasedAt);
    if (body.data.returnWindowEndsAt !== undefined) {
      data.returnWindowEndsAt = body.data.returnWindowEndsAt
        ? new Date(body.data.returnWindowEndsAt)
        : null;
    }
    if (body.data.receiptRef !== undefined) data.receiptRef = body.data.receiptRef;
    const purchase = await prisma.purchase.update({ where: { id }, data: data as never });
    await writeAudit(userId, 'purchase.patch', { entityType: 'Purchase', entityId: id });
    return reply.send({ purchase });
  });

  app.delete('/purchases/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.purchase.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.purchase.delete({ where: { id } });
    await writeAudit(userId, 'purchase.delete', { entityType: 'Purchase', entityId: id });
    return reply.status(204).send();
  });
}
