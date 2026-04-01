import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parsePagination } from '../../lib/pagination.js';
import { getUserId } from '../../lib/user.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { nextRetryAt } from '@life-os/scheduling';

export async function registerHardeningSyncRoutes(app: FastifyInstance) {
  app.get('/sync/status', async (req, reply) => {
    const userId = await getUserId();
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const [pending, failed, blocked, applied, suppressed, conflictCount] = await Promise.all([
      prisma.syncOutbox.count({
        where: { mutation: { userId }, syncStatus: 'PENDING' },
      }),
      prisma.syncOutbox.count({
        where: { mutation: { userId }, syncStatus: 'FAILED' },
      }),
      prisma.syncOutbox.count({
        where: { mutation: { userId }, syncStatus: 'BLOCKED_CONFLICT' },
      }),
      prisma.syncOutbox.count({
        where: { mutation: { userId }, syncStatus: 'APPLIED' },
      }),
      prisma.syncOutbox.count({
        where: { mutation: { userId }, syncStatus: 'SUPPRESSED' },
      }),
      prisma.conflictEvent.count({ where: { userId } }),
    ]);
    const lastApplied = await prisma.syncOutbox.findFirst({
      where: { mutation: { userId }, syncStatus: 'APPLIED' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return reply.send({
      paused: settings?.syncOutboxPaused === true,
      counts: { pending, failed, blocked, applied, suppressed, conflicts: conflictCount },
      lastSuccessfulApplyAt: lastApplied?.updatedAt ?? null,
    });
  });

  app.get('/sync/outbox', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { mutation: { userId } };
    const [total, rows] = await Promise.all([
      prisma.syncOutbox.count({ where }),
      prisma.syncOutbox.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          mutation: {
            select: {
              id: true,
              entityType: true,
              entityId: true,
              mutationType: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);
    return reply.send({
      data: rows,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.post('/sync/retry/:outboxId', async (req, reply) => {
    const userId = await getUserId();
    const outboxId = z.string().parse((req.params as { outboxId: string }).outboxId);
    const row = await prisma.syncOutbox.findFirst({
      where: { id: outboxId, mutation: { userId } },
    });
    if (!row) return reply.status(404).send({ error: 'Not found' });
    const now = new Date();
    const next = nextRetryAt(now, row.retryCount);
    await prisma.syncOutbox.update({
      where: { id: outboxId },
      data: {
        syncStatus: next ? 'PENDING' : 'FAILED',
        retryCount: { increment: 1 },
        nextRetryAt: next,
        lastError: next ? null : 'max_retries',
        updatedAt: now,
      },
    });
    return reply.send({ ok: true });
  });

  app.post('/sync/pause', async (_req, reply) => {
    const userId = await getUserId();
    await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, syncOutboxPaused: true },
      update: { syncOutboxPaused: true },
    });
    return reply.send({ ok: true, paused: true });
  });

  app.post('/sync/resume', async (_req, reply) => {
    const userId = await getUserId();
    await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, syncOutboxPaused: false },
      update: { syncOutboxPaused: false },
    });
    return reply.send({ ok: true, paused: false });
  });
}
