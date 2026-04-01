import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parsePagination } from '../../lib/pagination.js';
import { getUserId } from '../../lib/user.js';
import { buildPaginatedMeta } from '@life-os/shared';

export async function registerHardeningDiagnosticsRoutes(app: FastifyInstance) {
  app.get('/diagnostics/traces', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.traceEvent.count({ where }),
      prisma.traceEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/diagnostics/explanations/:entityType/:entityId', async (req, reply) => {
    const userId = await getUserId();
    const entityType = z.string().parse((req.params as { entityType: string }).entityType);
    const entityId = z.string().parse((req.params as { entityId: string }).entityId);
    const { page, pageSize, skip } = parsePagination(req);
    const where = {
      userId,
      surfacedEntityType: entityType,
      surfacedEntityId: entityId,
    };
    const [total, data] = await Promise.all([
      prisma.explanationEvent.count({ where }),
      prisma.explanationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/diagnostics/projections', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.projectionRefresh.count({ where }),
      prisma.projectionRefresh.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });
}
