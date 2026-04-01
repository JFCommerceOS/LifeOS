import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

function utcDay(d: string): Date {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

const upsertBody = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalMinutes: z.number().int().min(0),
  categoryMinutesJson: z.string().optional(),
  lateNightMinutes: z.number().int().min(0).optional(),
});

export async function registerScreenTimeSummaryRoutes(app: FastifyInstance) {
  app.get('/screen-time-summaries', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.screenTimeSummary.count({ where }),
      prisma.screenTimeSummary.findMany({
        where,
        orderBy: { day: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/screen-time-summaries', async (req, reply) => {
    const userId = await getUserId();
    const body = upsertBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const day = utcDay(body.data.day);
    const row = await prisma.screenTimeSummary.upsert({
      where: { userId_day: { userId, day } },
      create: {
        userId,
        day,
        totalMinutes: body.data.totalMinutes,
        categoryMinutesJson: body.data.categoryMinutesJson ?? '{}',
        lateNightMinutes: body.data.lateNightMinutes ?? 0,
      },
      update: {
        totalMinutes: body.data.totalMinutes,
        categoryMinutesJson: body.data.categoryMinutesJson ?? '{}',
        lateNightMinutes: body.data.lateNightMinutes ?? 0,
      },
    });
    await writeAudit(userId, 'screen_time_summary.upsert', { entityType: 'ScreenTimeSummary', entityId: row.id });
    return reply.status(201).send({ screenTimeSummary: row });
  });
}
