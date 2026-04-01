import type { AdminRecordStatus } from '@prisma/client';
import { prisma } from '@life-os/database';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { recordAdminAction } from '../../services/admin-ingest-service.js';

const patchBody = z
  .object({
    title: z.string().min(1).max(500).optional(),
    issuerName: z.string().max(500).nullable().optional(),
    status: z.enum(['ACTIVE', 'PAID', 'COMPLETED', 'DISMISSED', 'ARCHIVED', 'EXPIRED']).optional(),
    dueAt: z.string().datetime().nullable().optional(),
    renewsAt: z.string().datetime().nullable().optional(),
    returnWindowEndsAt: z.string().datetime().nullable().optional(),
    amountValue: z.number().nullable().optional(),
    reasonSummary: z.string().max(2000).optional(),
  })
  .strict();

const actionBody = z.object({
  note: z.string().max(2000).optional(),
  snoozeUntil: z.string().datetime().optional(),
});

const correctBody = z.object({
  title: z.string().max(500).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  amountValue: z.number().nullable().optional(),
  note: z.string().max(2000).optional(),
});

/** Sprint 07 — Admin Guard routes (+ legacy `/admin/summary`). */
export async function registerAdminGuardRoutes(app: FastifyInstance) {
  app.get('/admin/summary', async (_req, reply) => {
    const userId = await getUserId();
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [upcomingRenewals, returnWindowsClosing, adminActive] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          userId,
          active: true,
          renewalAt: { gte: now, lte: horizon },
        },
        orderBy: { renewalAt: 'asc' },
        take: 50,
      }),
      prisma.purchase.findMany({
        where: {
          userId,
          returnWindowEndsAt: { gte: now, lte: horizon },
        },
        orderBy: { returnWindowEndsAt: 'asc' },
        take: 50,
      }),
      prisma.adminRecord.count({
        where: { userId, status: 'ACTIVE' },
      }),
    ]);

    return reply.send({ upcomingRenewals, returnWindowsClosing, adminActiveCount: adminActive });
  });

  app.get('/admin/overview', async (_req, reply) => {
    const userId = await getUserId();
    const now = new Date();
    const [active, dueSoon, receipts] = await Promise.all([
      prisma.adminRecord.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: [{ dueAt: 'asc' }, { renewsAt: 'asc' }],
        take: 40,
        include: { deadlines: { take: 5 }, receipts: { take: 3 } },
      }),
      prisma.adminRecord.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          OR: [
            { dueAt: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } },
            { renewsAt: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } },
            { returnWindowEndsAt: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } },
          ],
        },
        take: 30,
      }),
      prisma.adminReceipt.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return reply.send({ active, dueSoon, receipts });
  });

  app.get('/admin', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const status = z.string().optional().safeParse((req.query as { status?: string }).status);
    const where = {
      userId,
      ...(status.success && status.data ? { status: status.data as AdminRecordStatus } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.adminRecord.count({ where }),
      prisma.adminRecord.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: { deadlines: { take: 3 }, receipts: { take: 2 } },
      }),
    ]);
    return reply.send({ data: rows, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.get('/receipts', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const [total, rows] = await Promise.all([
      prisma.adminReceipt.count({ where: { userId } }),
      prisma.adminReceipt.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data: rows, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.get('/receipts/:receiptId', async (req, reply) => {
    const userId = await getUserId();
    const receiptId = z.string().parse((req.params as { receiptId: string }).receiptId);
    const row = await prisma.adminReceipt.findFirst({
      where: { id: receiptId, userId },
      include: { adminRecord: true, document: { select: { id: true, title: true } } },
    });
    if (!row) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    return reply.send({ receipt: row });
  });

  app.get('/admin/:adminRecordId', async (req, reply) => {
    const userId = await getUserId();
    const adminRecordId = z.string().parse((req.params as { adminRecordId: string }).adminRecordId);
    const row = await prisma.adminRecord.findFirst({
      where: { id: adminRecordId, userId },
      include: {
        deadlines: { orderBy: { dueAt: 'asc' } },
        receipts: true,
        actions: { orderBy: { actedAt: 'desc' }, take: 30 },
        document: { select: { id: true, title: true, processingStatus: true } },
      },
    });
    if (!row) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    const ob = await prisma.obligation.findFirst({
      where: { userId, sourceEntityType: 'AdminRecord', sourceEntityId: adminRecordId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ record: row, obligation: ob });
  });

  app.patch('/admin/:adminRecordId', async (req, reply) => {
    const userId = await getUserId();
    const adminRecordId = z.string().parse((req.params as { adminRecordId: string }).adminRecordId);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.adminRecord.findFirst({ where: { id: adminRecordId, userId } });
    if (!existing) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const data: Record<string, unknown> = {};
    if (body.data.title !== undefined) data.title = body.data.title;
    if (body.data.issuerName !== undefined) data.issuerName = body.data.issuerName;
    if (body.data.status !== undefined) data.status = body.data.status as AdminRecordStatus;
    if (body.data.amountValue !== undefined) data.amountValue = body.data.amountValue;
    if (body.data.reasonSummary !== undefined) data.reasonSummary = body.data.reasonSummary;
    if (body.data.dueAt !== undefined) data.dueAt = body.data.dueAt ? new Date(body.data.dueAt) : null;
    if (body.data.renewsAt !== undefined) data.renewsAt = body.data.renewsAt ? new Date(body.data.renewsAt) : null;
    if (body.data.returnWindowEndsAt !== undefined) {
      data.returnWindowEndsAt = body.data.returnWindowEndsAt ? new Date(body.data.returnWindowEndsAt) : null;
    }

    const record = await prisma.adminRecord.update({ where: { id: adminRecordId }, data: data as never });
    await writeAudit(userId, 'admin_record.patch', { entityType: 'AdminRecord', entityId: adminRecordId });
    return reply.send({ record });
  });

  async function postAction(
    action: 'MARK_PAID' | 'MARK_COMPLETED' | 'SNOOZE' | 'DISMISS' | 'CORRECT' | 'ARCHIVE',
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getUserId();
    const adminRecordId = z.string().parse((req.params as { adminRecordId: string }).adminRecordId);
    const body = actionBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.adminRecord.findFirst({ where: { id: adminRecordId, userId } });
    if (!existing) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    let snooze: Date | null | undefined;
    if (action === 'SNOOZE' && body.data.snoozeUntil) {
      snooze = new Date(body.data.snoozeUntil);
    }

    await recordAdminAction(
      userId,
      adminRecordId,
      action,
      body.data.note ?? '',
      snooze,
    );
    await writeAudit(userId, `admin_record.${action.toLowerCase()}`, {
      entityType: 'AdminRecord',
      entityId: adminRecordId,
    });
    const record = await prisma.adminRecord.findFirst({ where: { id: adminRecordId, userId } });
    return reply.send({ ok: true, record });
  }

  app.post('/admin/:adminRecordId/mark-paid', (req, reply) => postAction('MARK_PAID', req, reply));
  app.post('/admin/:adminRecordId/complete', (req, reply) => postAction('MARK_COMPLETED', req, reply));
  app.post('/admin/:adminRecordId/snooze', (req, reply) => postAction('SNOOZE', req, reply));
  app.post('/admin/:adminRecordId/archive', (req, reply) => postAction('ARCHIVE', req, reply));
  app.post('/admin/:adminRecordId/dismiss', (req, reply) => postAction('DISMISS', req, reply));

  app.post('/admin/:adminRecordId/correct', async (req, reply) => {
    const userId = await getUserId();
    const adminRecordId = z.string().parse((req.params as { adminRecordId: string }).adminRecordId);
    const body = correctBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.adminRecord.findFirst({ where: { id: adminRecordId, userId } });
    if (!existing) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const data: Record<string, unknown> = {};
    if (body.data.title !== undefined) data.title = body.data.title;
    if (body.data.dueAt !== undefined) data.dueAt = body.data.dueAt ? new Date(body.data.dueAt) : null;
    if (body.data.amountValue !== undefined) data.amountValue = body.data.amountValue;

    await recordAdminAction(userId, adminRecordId, 'CORRECT', body.data.note ?? '');
    const record = await prisma.adminRecord.update({
      where: { id: adminRecordId },
      data: data as never,
    });
    await writeAudit(userId, 'admin_record.correct', { entityType: 'AdminRecord', entityId: adminRecordId });
    return reply.send({ record });
  });
}

export const registerAdminSummaryRoutes = registerAdminGuardRoutes;
