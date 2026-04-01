import {
  MemoryLayerType,
  MemoryNodeType,
} from '@prisma/client';
import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { applyDecayForUser } from '../../services/memory-decay-service.js';
import { recordMemoryConfirmation, applyMemoryCorrection } from '../../services/memory-confirmation-service.js';
import { getMemoryNodeWithGraph } from '../../services/memory-graph-service.js';
import { retrieveMemoryForUser } from '../../services/memory-retrieval-service.js';

const confirmBody = z.object({
  memoryNodeId: z.string().min(1),
  confirmed: z.boolean(),
});

const correctBody = z.object({
  memoryNodeId: z.string().min(1),
  correctionNote: z.string().min(1),
  newSummary: z.string().optional(),
  correctedFields: z
    .object({
      summary: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const archiveBody = z.object({
  memoryNodeId: z.string().min(1),
  reason: z.string().optional(),
});

export async function registerMemoryRoutes(app: FastifyInstance) {
  /** Must be registered before `/memory/:id` */
  app.get('/memory/entity/:entityType/:entityId', async (req, reply) => {
    const userId = await getUserId();
    const entityType = z.string().min(1).parse((req.params as { entityType: string }).entityType);
    const entityId = z.string().min(1).parse((req.params as { entityId: string }).entityId);

    const nodes = await prisma.memoryNode.findMany({
      where: {
        userId,
        refEntityType: entityType,
        refEntityId: entityId,
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        evidenceLinks: { take: 8, orderBy: { createdAt: 'desc' } },
      },
    });

    return reply.send({ entityType, entityId, nodes });
  });

  app.get('/memory', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);

    const q = req.query as {
      layer?: string;
      nodeType?: string;
      includeArchived?: string;
      runDecay?: string;
    };

    if (q.runDecay === '1' || q.runDecay === 'true') {
      const decay = await applyDecayForUser(userId);
      await writeAudit(userId, 'memory.decay.run', { meta: decay });
    }

    const includeArchived = q.includeArchived === '1' || q.includeArchived === 'true';

    const layerParse = z.nativeEnum(MemoryLayerType).optional().safeParse(q.layer);
    const nodeParse = z.nativeEnum(MemoryNodeType).optional().safeParse(q.nodeType);

    const where = {
      userId,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(layerParse.success && layerParse.data ? { layerType: layerParse.data } : {}),
      ...(nodeParse.success && nodeParse.data ? { nodeType: nodeParse.data } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.memoryNode.count({ where }),
      prisma.memoryNode.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          nodeType: true,
          summary: true,
          confidence: true,
          strengthScore: true,
          layerType: true,
          sensitivityClass: true,
          refEntityType: true,
          refEntityId: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return reply.send({
      data: rows,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/memory/retrieve', async (req, reply) => {
    const userId = await getUserId();
    const q = req.query as { limit?: string; layer?: string; includeArchived?: string };
    const limit = z.coerce.number().int().min(1).max(100).optional().parse(q.limit);
    const includeArchived = q.includeArchived === '1' || q.includeArchived === 'true';

    const layerParse = z.nativeEnum(MemoryLayerType).optional().safeParse(q.layer);
    const nodes = await retrieveMemoryForUser(userId, {
      limit,
      layerTypes: layerParse.success && layerParse.data ? [layerParse.data] : undefined,
      includeArchived,
    });
    return reply.send({ nodes });
  });

  app.get('/memory/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    await prisma.memoryNode.updateMany({
      where: { id, userId },
      data: { lastAccessedAt: new Date() },
    });
    const node = await getMemoryNodeWithGraph(userId, id);
    if (!node) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    let sourceEntitySummary: Record<string, unknown> | null = null;
    if (node.refEntityType === 'Obligation' && node.refEntityId) {
      const ob = await prisma.obligation.findFirst({
        where: { id: node.refEntityId, userId },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          surfacedCount: true,
          lastSurfacedAt: true,
          lastConfirmedAt: true,
          lastDismissedAt: true,
          lastResolvedAt: true,
          suppressionUntil: true,
        },
      });
      sourceEntitySummary = ob ? { type: 'Obligation', obligation: ob } : null;
    } else if (node.refEntityType === 'Suggestion' && node.refEntityId) {
      const sg = await prisma.suggestion.findFirst({
        where: { id: node.refEntityId, userId },
        select: {
          id: true,
          title: true,
          state: true,
          linkedObligationId: true,
          lastShownAt: true,
          actedOnAt: true,
        },
      });
      sourceEntitySummary = sg ? { type: 'Suggestion', suggestion: sg } : null;
    }

    let relatedObligations: Awaited<ReturnType<typeof prisma.obligation.findMany>> = [];
    if (node.refEntityType === 'Suggestion' && node.refEntityId) {
      const s = await prisma.suggestion.findFirst({
        where: { id: node.refEntityId, userId },
        include: { linkedObligation: true },
      });
      if (s?.linkedObligation) relatedObligations = [s.linkedObligation];
    }

    const relatedSuggestions =
      node.refEntityType === 'Obligation' && node.refEntityId
        ? await prisma.suggestion.findMany({
            where: { userId, linkedObligationId: node.refEntityId },
            take: 10,
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const feedbackSummary =
      relatedSuggestions.length > 0
        ? await prisma.feedbackSignal.count({
            where: { userId, suggestionId: { in: relatedSuggestions.map((s) => s.id) } },
          })
        : 0;

    return reply.send({
      node,
      lineage: {
        sourceEntitySummary,
        relatedObligations,
        relatedSuggestions,
        feedbackSignalCount: feedbackSummary,
      },
    });
  });

  app.post('/memory/confirm', async (req, reply) => {
    const userId = await getUserId();
    const body = confirmBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const confirmation = await recordMemoryConfirmation({
      userId,
      memoryNodeId: body.data.memoryNodeId,
      confirmedByUser: body.data.confirmed,
    });
    await writeAudit(userId, 'memory.confirm', {
      entityType: 'MemoryNode',
      entityId: body.data.memoryNodeId,
    });
    return reply.status(201).send({ confirmation });
  });

  app.post('/memory/correct', async (req, reply) => {
    const userId = await getUserId();
    const body = correctBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    await applyMemoryCorrection({
      userId,
      memoryNodeId: body.data.memoryNodeId,
      correctionNote: body.data.correctionNote,
      newSummary: body.data.correctedFields?.summary ?? body.data.newSummary,
      correctedConfidence: body.data.correctedFields?.confidence,
    });
    await writeAudit(userId, 'memory.correct', {
      entityType: 'MemoryNode',
      entityId: body.data.memoryNodeId,
    });
    return reply.status(201).send({ ok: true });
  });

  app.post('/memory/archive', async (req, reply) => {
    const userId = await getUserId();
    const body = archiveBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const node = await prisma.memoryNode.findFirst({
      where: { id: body.data.memoryNodeId, userId },
    });
    if (!node) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    await prisma.$transaction([
      prisma.memoryArchiveRecord.create({
        data: { memoryNodeId: node.id, reason: body.data.reason ?? 'user_archive' },
      }),
      prisma.memoryNode.update({
        where: { id: node.id },
        data: { layerType: 'cold_archive', archivedAt: new Date() },
      }),
    ]);

    await writeAudit(userId, 'memory.archive', {
      entityType: 'MemoryNode',
      entityId: node.id,
    });
    return reply.status(201).send({ ok: true });
  });

  app.delete('/memory/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const node = await prisma.memoryNode.findFirst({ where: { id, userId } });
    if (!node) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    await prisma.memoryNode.delete({ where: { id } });
    await writeAudit(userId, 'memory.delete', { entityType: 'MemoryNode', entityId: id });
    return reply.status(204).send();
  });
}
