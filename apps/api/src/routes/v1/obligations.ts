import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { resolveSecurityContext } from '../../lib/security-context.js';
import {
  applyObligationLifecycle,
  InvalidLifecycleTransitionError,
  type ObligationLifecycleAction,
} from '../../services/continuity-obligation-lifecycle.js';
import {
  mapLifecycleToMutationType,
  recordEntityMutationBundle,
} from '../../services/mutation-log-service.js';

const patchBody = z
  .object({
    status: z.enum(['open', 'done', 'dismissed', 'confirmed', 'resolved', 'reopened']).optional(),
    title: z.string().min(1).optional(),
    dueAt: z.string().datetime().nullable().optional(),
    description: z.string().nullable().optional(),
    action: z.enum(['confirm', 'dismiss', 'resolve', 'reopen']).optional(),
    note: z.string().max(4000).optional(),
  })
  .strict();

const statusToLifecycle: Partial<Record<string, ObligationLifecycleAction>> = {
  confirmed: 'confirm',
  dismissed: 'dismiss',
  resolved: 'resolve',
  reopened: 'reopen',
};

export async function registerObligationRoutes(app: FastifyInstance) {
  app.get('/obligations', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, obligations] = await Promise.all([
      prisma.obligation.count({ where }),
      prisma.obligation.findMany({
        where,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data: obligations,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/obligations/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const obligation = await prisma.obligation.findFirst({
      where: { id, userId },
      include: {
        evidenceItems: { orderBy: { createdAt: 'asc' } },
        sourceSignal: {
          select: { id: true, signalType: true, processingStatus: true, receivedAt: true },
        },
        linkedSuggestions: {
          select: {
            id: true,
            title: true,
            state: true,
            rank: true,
            lastShownAt: true,
            suggestionType: true,
          },
        },
      },
    });
    if (!obligation) return reply.status(404).send({ error: 'Not found' });
    return reply.send({
      obligation,
      evidenceCount: obligation.evidenceItems.length,
      sourceEntity:
        obligation.sourceEntityType && obligation.sourceEntityId
          ? { type: obligation.sourceEntityType, id: obligation.sourceEntityId }
          : null,
    });
  });

  app.patch('/obligations/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.obligation.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    const lifecycleFromStatus =
      body.data.status && !body.data.action ? statusToLifecycle[body.data.status] : undefined;
    const lifecycleAction = body.data.action ?? lifecycleFromStatus;

    try {
      if (lifecycleAction) {
        const obligation = await applyObligationLifecycle({
          userId,
          obligationId: id,
          existing,
          action: lifecycleAction,
          dismissNote: lifecycleAction === 'dismiss' ? body.data.note : undefined,
        });

        const scalar: {
          title?: string;
          dueAt?: Date | null;
          description?: string | null;
        } = {};
        if (body.data.title !== undefined) scalar.title = body.data.title;
        if (body.data.description !== undefined) scalar.description = body.data.description;
        if (body.data.dueAt !== undefined) scalar.dueAt = body.data.dueAt ? new Date(body.data.dueAt) : null;

        const updated =
          Object.keys(scalar).length > 0
            ? await prisma.obligation.update({ where: { id }, data: scalar })
            : obligation;

        await writeAudit(userId, 'obligation.patch', {
          entityType: 'Obligation',
          entityId: id,
          meta: { ...body.data, lifecycle: lifecycleAction },
        });
        const sec = await resolveSecurityContext(req);
        const explain =
          lifecycleAction === 'dismiss' || lifecycleAction === 'resolve'
            ? {
                reasonType: lifecycleAction === 'dismiss' ? 'user_dismissed' : 'user_resolve',
                summary:
                  lifecycleAction === 'dismiss'
                    ? 'Obligation dismissed; sync outbox and projections scheduled.'
                    : 'Obligation resolved; continuity version updated.',
                confidence: 0.95,
              }
            : undefined;
        await recordEntityMutationBundle({
          userId,
          deviceId: sec.edgeDevice?.id,
          actorType: 'user',
          entityType: 'Obligation',
          entityId: id,
          mutationType: mapLifecycleToMutationType(lifecycleAction),
          payload: {
            status: updated.status,
            lifecycle: lifecycleAction,
          },
          surfaceExplanation: explain,
        });
        return reply.send({
          obligation: updated,
          continuity: {
            surfacedCount: updated.surfacedCount,
            lastSurfacedAt: updated.lastSurfacedAt,
            lastDismissedAt: updated.lastDismissedAt,
            lastConfirmedAt: updated.lastConfirmedAt,
            lastResolvedAt: updated.lastResolvedAt,
            suppressionUntil: updated.suppressionUntil,
          },
        });
      }

      const data: {
        status?: 'open' | 'done' | 'dismissed' | 'confirmed' | 'resolved' | 'reopened';
        title?: string;
        dueAt?: Date | null;
        description?: string | null;
      } = {};
      if (body.data.status !== undefined) data.status = body.data.status;
      if (body.data.title !== undefined) data.title = body.data.title;
      if (body.data.description !== undefined) data.description = body.data.description;
      if (body.data.dueAt !== undefined) {
        data.dueAt = body.data.dueAt ? new Date(body.data.dueAt) : null;
      }

      const obligation = await prisma.obligation.update({ where: { id }, data });
      await writeAudit(userId, 'obligation.patch', { entityType: 'Obligation', entityId: id, meta: body.data });
      return reply.send({
        obligation,
        continuity: {
          surfacedCount: obligation.surfacedCount,
          lastSurfacedAt: obligation.lastSurfacedAt,
          lastDismissedAt: obligation.lastDismissedAt,
          lastConfirmedAt: obligation.lastConfirmedAt,
          lastResolvedAt: obligation.lastResolvedAt,
          suppressionUntil: obligation.suppressionUntil,
        },
      });
    } catch (e) {
      if (e instanceof InvalidLifecycleTransitionError) {
        return reply.status(409).send({ error: { message: e.message, code: 'INVALID_TRANSITION' } });
      }
      throw e;
    }
  });
}
