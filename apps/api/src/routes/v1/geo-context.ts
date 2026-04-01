import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { GeoContextType } from '@prisma/client';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z
  .object({
    contextType: z.nativeEnum(GeoContextType),
    placeLabel: z.string().optional(),
    placeClass: z.string().optional(),
    relevanceWindowStart: z.string().datetime().optional(),
    relevanceWindowEnd: z.string().datetime().optional(),
    transitRisk: z.number().min(0).max(1).optional(),
    summaryJson: z.string().optional(),
  })
  .strict();

export async function registerGeoContextRoutes(app: FastifyInstance) {
  app.get('/geo-context', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.geoContextEvent.count({ where }),
      prisma.geoContextEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/geo-context', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const d = body.data;
    const geoContextEvent = await prisma.geoContextEvent.create({
      data: {
        userId,
        contextType: d.contextType,
        placeLabel: d.placeLabel,
        placeClass: d.placeClass,
        relevanceWindowStart: d.relevanceWindowStart ? new Date(d.relevanceWindowStart) : undefined,
        relevanceWindowEnd: d.relevanceWindowEnd ? new Date(d.relevanceWindowEnd) : undefined,
        transitRisk: d.transitRisk,
        summaryJson: d.summaryJson ?? '{}',
      },
    });
    return reply.status(201).send({ geoContextEvent });
  });
}
