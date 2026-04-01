import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { buildDedupeKey } from '@life-os/sync';
import { coalesceScheduledTime } from '@life-os/scheduling';

const refreshBody = z.object({
  projectionType: z.string().min(1).optional(),
  triggerRef: z.string().optional(),
});

export async function registerHardeningProjectionRoutes(app: FastifyInstance) {
  app.post('/projections/refresh', async (req, reply) => {
    const userId = await getUserId();
    const body = refreshBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const projectionType = body.data.projectionType ?? 'daily_brief';

    const projection = await prisma.projectionRefresh.create({
      data: {
        projectionType,
        userId,
        triggerType: 'manual_api',
        triggerRef: body.data.triggerRef,
        refreshStatus: 'scheduled',
      },
    });

    const when = coalesceScheduledTime(new Date());
    const dedupeKey = buildDedupeKey({
      userId,
      jobType: 'projection_refresh',
      linkedEntityType: projectionType,
      linkedEntityId: projection.id,
    });
    const existing = await prisma.scheduledJob.findFirst({
      where: {
        userId,
        dedupeKey,
        status: { in: ['PENDING', 'CLAIMED', 'RUNNING'] },
      },
    });
    if (existing) {
      await prisma.scheduledJob.update({
        where: { id: existing.id },
        data: { scheduledFor: when, updatedAt: new Date() },
      });
    } else {
      await prisma.scheduledJob.create({
        data: {
          jobType: 'projection_refresh',
          userId,
          linkedEntityType: projectionType,
          linkedEntityId: projection.id,
          priority: 1,
          scheduledFor: when,
          status: 'PENDING',
          dedupeKey,
        },
      });
    }

    return reply.send({ projection, scheduledFor: when.toISOString() });
  });
}
