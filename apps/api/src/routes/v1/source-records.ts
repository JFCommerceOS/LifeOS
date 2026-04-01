import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z.object({
  connectorId: z.string().min(1),
  payloadJson: z.string().min(1),
  externalId: z.string().nullable().optional(),
  normalizedJson: z.string().nullable().optional(),
});

export async function registerSourceRecordRoutes(app: FastifyInstance) {
  app.get('/source-records', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const connectorId = z.string().optional().safeParse((req.query as { connectorId?: string }).connectorId);

    const where = {
      userId,
      ...(connectorId.success && connectorId.data ? { connectorId: connectorId.data } : {}),
    };

    const [total, records] = await Promise.all([
      prisma.sourceRecord.count({ where }),
      prisma.sourceRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          connectorId: true,
          externalId: true,
          createdAt: true,
          payloadJson: true,
          normalizedJson: true,
        },
      }),
    ]);

    const data = records.map((r) => ({
      id: r.id,
      connectorId: r.connectorId,
      externalId: r.externalId,
      createdAt: r.createdAt,
      hasNormalized: r.normalizedJson != null,
      payloadLength: r.payloadJson.length,
    }));

    return reply.send({
      data,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/source-records/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const record = await prisma.sourceRecord.findFirst({
      where: { id, userId },
      include: {
        connector: { select: { id: true, name: true, type: true, connectorType: true, status: true } },
      },
    });
    if (!record) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    const [linkedEvent, linkedTask, signals, linkedSuggestion] = await Promise.all([
      prisma.event.findFirst({ where: { userId, sourceRecordId: id } }),
      prisma.task.findFirst({ where: { userId, sourceRecordId: id } }),
      prisma.signalEnvelope.findMany({
        where: { userId, sourceRecordId: id },
        orderBy: { receivedAt: 'desc' },
        take: 15,
        select: {
          id: true,
          signalType: true,
          processingStatus: true,
          receivedAt: true,
          contentHash: true,
        },
      }),
      prisma.suggestion.findFirst({
        where: { userId, linkedEntityType: 'SourceRecord', linkedEntityId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return reply.send({
      record,
      linkedEvent,
      linkedTask,
      signals,
      linkedSuggestion,
    });
  });

  app.post('/source-records', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const connector = await prisma.sourceConnector.findFirst({
      where: { id: body.data.connectorId, userId },
    });
    if (!connector) {
      return reply.status(400).send({
        error: { message: 'Connector not found for user', code: 'INVALID_CONNECTOR' },
      });
    }

    const record = await prisma.sourceRecord.create({
      data: {
        userId,
        connectorId: body.data.connectorId,
        externalId: body.data.externalId ?? undefined,
        payloadJson: body.data.payloadJson,
        normalizedJson: body.data.normalizedJson ?? undefined,
      },
    });

    await writeAudit(userId, 'source_record.create', {
      entityType: 'SourceRecord',
      entityId: record.id,
      meta: { connectorId: record.connectorId },
    });

    return reply.status(201).send({
      record: {
        id: record.id,
        connectorId: record.connectorId,
        externalId: record.externalId,
        payloadJson: record.payloadJson,
        normalizedJson: record.normalizedJson,
        createdAt: record.createdAt,
      },
    });
  });
}
