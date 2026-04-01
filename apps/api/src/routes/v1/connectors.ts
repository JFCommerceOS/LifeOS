import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { listConnectorCatalog } from '../../services/connector-registry-service.js';
import {
  runConnectorPurge,
  runConnectorResync,
  runConnectorSync,
  seedConnectorPermissions,
} from '../../services/connector-sync-service.js';

const createBody = z
  .object({
    connectorType: z.enum(['CALENDAR', 'TASKS', 'EMAIL_METADATA', 'STUB']),
    name: z.string().min(1),
    configJson: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

const patchBody = z
  .object({
    name: z.string().min(1).optional(),
    configJson: z.string().optional(),
    enabled: z.boolean().optional(),
    status: z.enum(['DISCONNECTED', 'CONNECTING', 'ACTIVE', 'PAUSED', 'ERROR']).optional(),
    syncMode: z.enum(['MANUAL_ONLY', 'SCHEDULED']).optional(),
    scopeJson: z.string().optional(),
    cursorJson: z.string().optional(),
  })
  .strict();

function notFound() {
  return { error: { code: 'NOT_FOUND', message: 'Connector not found' } };
}

export async function registerConnectorRoutes(app: FastifyInstance) {
  app.get('/connectors/catalog', async (_req, reply) => {
    return reply.send({ catalog: listConnectorCatalog() });
  });

  app.get('/connectors', async (_req, reply) => {
    const userId = await getUserId();
    const connectors = await prisma.sourceConnector.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        permissions: true,
        _count: { select: { records: true, syncRuns: true } },
      },
    });
    return reply.send({ connectors });
  });

  app.get('/connectors/:id/data-summary', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const c = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!c) return reply.status(404).send(notFound());
    const [sourceRecordCount, linkedEvents, linkedTasks, lastSourceTouch, lastRun] = await Promise.all([
      prisma.sourceRecord.count({ where: { connectorId: id } }),
      prisma.event.count({
        where: { userId, sourceRecord: { connectorId: id } },
      }),
      prisma.task.count({
        where: { userId, sourceRecord: { connectorId: id } },
      }),
      prisma.sourceRecord.findFirst({
        where: { connectorId: id },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      prisma.connectorSyncRun.findFirst({
        where: { connectorId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return reply.send({
      connectorId: id,
      displayName: c.name,
      connectorType: c.connectorType,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      sourceRecordCount,
      linkedDerivedEvents: linkedEvents,
      linkedDerivedTasks: linkedTasks,
      lastSourceRecordTouch: lastSourceTouch?.updatedAt ?? null,
      lastSyncRun: lastRun,
      rawPayloadRetentionNote:
        'Connector payloads are stored as source records (evidence-short-life class). Purge removes imported rows; audit logs may retain minimal entries.',
    });
  });

  app.get('/connectors/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const connector = await prisma.sourceConnector.findFirst({
      where: { id, userId },
      include: {
        permissions: true,
        _count: { select: { records: true } },
      },
    });
    if (!connector) return reply.status(404).send(notFound());
    const recentRuns = await prisma.connectorSyncRun.findMany({
      where: { connectorId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return reply.send({ connector, recentRuns });
  });

  app.post('/connectors', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const connector = await prisma.sourceConnector.create({
      data: {
        userId,
        type: body.data.connectorType.toLowerCase(),
        connectorType: body.data.connectorType,
        name: body.data.name,
        configJson: body.data.configJson ?? '{}',
        enabled: body.data.enabled ?? false,
        status: 'DISCONNECTED',
      },
    });
    await writeAudit(userId, 'connector.create', { entityType: 'SourceConnector', entityId: connector.id });
    return reply.status(201).send({ connector });
  });

  app.patch('/connectors/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send(notFound());
    const connector = await prisma.sourceConnector.update({ where: { id }, data: body.data });
    await writeAudit(userId, 'connector.patch', { entityType: 'SourceConnector', entityId: id });
    return reply.send({ connector });
  });

  app.post('/connectors/:id/connect', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send(notFound());
    await seedConnectorPermissions(id, existing.connectorType);
    const connector = await prisma.sourceConnector.update({
      where: { id },
      data: { status: 'ACTIVE', enabled: true, authMode: 'stub' },
    });
    await writeAudit(userId, 'connector.connect', { entityType: 'SourceConnector', entityId: id });
    return reply.send({ connector });
  });

  app.post('/connectors/:id/pause', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send(notFound());
    const connector = await prisma.sourceConnector.update({
      where: { id },
      data: { status: 'PAUSED', enabled: false },
    });
    await writeAudit(userId, 'connector.pause', { entityType: 'SourceConnector', entityId: id });
    return reply.send({ connector });
  });

  app.post('/connectors/:id/resume', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send(notFound());
    const connector = await prisma.sourceConnector.update({
      where: { id },
      data: { status: 'ACTIVE', enabled: true },
    });
    await writeAudit(userId, 'connector.resume', { entityType: 'SourceConnector', entityId: id });
    return reply.send({ connector });
  });

  app.post('/connectors/:id/disconnect', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send(notFound());
    const connector = await prisma.sourceConnector.update({
      where: { id },
      data: { status: 'DISCONNECTED', enabled: false },
    });
    await writeAudit(userId, 'connector.disconnect', { entityType: 'SourceConnector', entityId: id });
    return reply.send({ connector });
  });

  app.post('/connectors/:id/sync', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send(notFound());
    try {
      const result = await runConnectorSync(userId, id, 'DELTA_SYNC');
      await writeAudit(userId, 'connector.sync', { entityType: 'SourceConnector', entityId: id, meta: result });
      return reply.send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'SYNC_FAILED';
      if (msg === 'CONNECTOR_NOT_SYNCABLE') {
        return reply.status(409).send({ error: { code: 'CONNECTOR_NOT_SYNCABLE', message: 'Connect or resume the connector first.' } });
      }
      throw e;
    }
  });

  app.post('/connectors/:id/resync', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send(notFound());
    try {
      const result = await runConnectorResync(userId, id);
      await writeAudit(userId, 'connector.resync', { entityType: 'SourceConnector', entityId: id, meta: result });
      return reply.send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'RESYNC_FAILED';
      if (msg === 'CONNECTOR_NOT_SYNCABLE') {
        return reply.status(409).send({ error: { code: 'CONNECTOR_NOT_SYNCABLE', message: 'Connect or resume the connector first.' } });
      }
      throw e;
    }
  });

  app.post('/connectors/:id/purge', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.sourceConnector.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send(notFound());
    const result = await runConnectorPurge(userId, id);
    await writeAudit(userId, 'connector.purge', { entityType: 'SourceConnector', entityId: id, meta: result });
    return reply.send(result);
  });

  app.get('/connectors/:id/runs', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const ok = await prisma.sourceConnector.findFirst({ where: { id, userId }, select: { id: true } });
    if (!ok) return reply.status(404).send(notFound());
    const { page, pageSize, skip } = parsePagination(req);
    const [total, runs] = await Promise.all([
      prisma.connectorSyncRun.count({ where: { connectorId: id } }),
      prisma.connectorSyncRun.findMany({
        where: { connectorId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data: runs, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.get('/connectors/:id/runs/:runId', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const runId = z.string().parse((req.params as { runId: string }).runId);
    const ok = await prisma.sourceConnector.findFirst({ where: { id, userId }, select: { id: true } });
    if (!ok) return reply.status(404).send(notFound());
    const run = await prisma.connectorSyncRun.findFirst({ where: { id: runId, connectorId: id } });
    if (!run) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Run not found' } });
    return reply.send({ run });
  });
}
