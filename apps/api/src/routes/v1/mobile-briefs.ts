import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { startOfUtcDay } from '@life-os/shared';
import {
  projectMobileBrief,
  projectMobileBriefSection,
} from '../../services/mobile-brief-projection.js';
import { getUserId } from '../../lib/user.js';

export async function registerMobileBriefRoutes(app: FastifyInstance) {
  app.get('/mobile/briefs/today', async (_req, reply) => {
    const userId = await getUserId();
    const dayKey = startOfUtcDay(new Date());
    const brief = await prisma.dailyBrief.findFirst({
      where: { userId, day: dayKey },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!brief) {
      return reply.send({
        day: dayKey.toISOString(),
        brief: null,
        sections: projectMobileBrief([]),
      });
    }
    return reply.send({
      day: dayKey.toISOString(),
      brief: { id: brief.id, day: brief.day },
      sections: projectMobileBrief(brief.items),
    });
  });

  app.get('/mobile/briefs/section/:bucket', async (req, reply) => {
    const userId = await getUserId();
    const bucket = z.string().parse((req.params as { bucket: string }).bucket);
    const dayKey = startOfUtcDay(new Date());
    const brief = await prisma.dailyBrief.findFirst({
      where: { userId, day: dayKey },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    const items = brief?.items ?? [];
    return reply.send({
      bucket,
      items: projectMobileBriefSection(bucket, items),
    });
  });
}
