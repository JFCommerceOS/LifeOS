import type { Prisma } from '@prisma/client';
import { prisma } from '@life-os/database';
import { buildExplanationPayload, summarizeForTrace } from '@life-os/observability';
import { buildDedupeKey, nextVersion } from '@life-os/sync';
import { coalesceScheduledTime } from '@life-os/scheduling';

export type RecordEntityMutationInput = {
  userId: string;
  deviceId?: string | null;
  actorType: string;
  entityType: string;
  entityId: string;
  mutationType: string;
  payload: Record<string, unknown>;
  causalGroupId?: string | null;
  targetScope?: string;
  /** When set, writes ExplanationEvent + trace summary. */
  surfaceExplanation?: {
    reasonType: string;
    summary: string;
    confidence?: number;
    evidenceRefs?: unknown[];
  };
};

/**
 * Durable mutation + entity version + outbox (+ optional explanation, trace, projection job).
 */
export async function recordEntityMutationBundle(
  input: RecordEntityMutationInput,
): Promise<{ mutationId: string; newVersion: number }> {
  const settings = await prisma.userSettings.findUnique({ where: { userId: input.userId } });
  const syncPaused = settings?.syncOutboxPaused === true;

  return prisma.$transaction(async (tx) => {
    const ev = await tx.entityVersion.findUnique({
      where: {
        userId_entityType_entityId: {
          userId: input.userId,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
    });
    const baseVersion = ev?.currentVersion ?? 0;
    const newVersion = nextVersion(baseVersion);

    const mutation = await tx.mutationLog.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId ?? undefined,
        actorType: input.actorType,
        entityType: input.entityType,
        entityId: input.entityId,
        mutationType: input.mutationType,
        payloadJson: input.payload as Prisma.InputJsonValue,
        baseVersion,
        newVersion,
        causalGroupId: input.causalGroupId ?? undefined,
      },
    });

    await tx.entityVersion.upsert({
      where: {
        userId_entityType_entityId: {
          userId: input.userId,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      create: {
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        currentVersion: newVersion,
        updatedByMutationId: mutation.id,
      },
      update: {
        currentVersion: newVersion,
        updatedByMutationId: mutation.id,
        updatedAt: new Date(),
      },
    });

    await tx.syncOutbox.create({
      data: {
        mutationId: mutation.id,
        targetScope: input.targetScope ?? 'default',
        syncStatus: syncPaused ? 'SUPPRESSED' : 'PENDING',
      },
    });

    if (input.surfaceExplanation) {
      await tx.explanationEvent.create({
        data: {
          userId: input.userId,
          surfacedEntityType: input.entityType,
          surfacedEntityId: input.entityId,
          reasonType: input.surfaceExplanation.reasonType,
          explanationJson: buildExplanationPayload({
            reasonType: input.surfaceExplanation.reasonType,
            summary: input.surfaceExplanation.summary,
          }) as Prisma.InputJsonValue,
          evidenceRefsJson: (input.surfaceExplanation.evidenceRefs ?? []) as Prisma.InputJsonValue,
          confidence: input.surfaceExplanation.confidence ?? 0.9,
        },
      });
    }

    await tx.traceEvent.create({
      data: {
        userId: input.userId,
        traceType: 'entity_mutation',
        stage: 'continuity',
        entityType: input.entityType,
        entityId: input.entityId,
        sourceRef: mutation.id,
        inputSummary: summarizeForTrace(JSON.stringify({ mutationType: input.mutationType })),
        outputSummary: summarizeForTrace(`version ${baseVersion}→${newVersion}`),
        status: 'ok',
      },
    });

    const dedupeKey = buildDedupeKey({
      userId: input.userId,
      jobType: 'projection_refresh',
      linkedEntityType: input.entityType,
      linkedEntityId: input.entityId,
    });
    const when = coalesceScheduledTime(new Date());
    const existing = await tx.scheduledJob.findFirst({
      where: {
        userId: input.userId,
        dedupeKey,
        status: { in: ['PENDING', 'CLAIMED', 'RUNNING'] },
      },
    });
    if (existing) {
      await tx.scheduledJob.update({
        where: { id: existing.id },
        data: { scheduledFor: when, updatedAt: new Date() },
      });
    } else {
      await tx.scheduledJob.create({
        data: {
          jobType: 'projection_refresh',
          userId: input.userId,
          linkedEntityType: input.entityType,
          linkedEntityId: input.entityId,
          priority: 0,
          scheduledFor: when,
          status: 'PENDING',
          dedupeKey,
        },
      });
    }

    await tx.projectionRefresh.create({
      data: {
        projectionType: 'daily_brief',
        userId: input.userId,
        triggerType: 'entity_mutation',
        triggerRef: mutation.id,
        refreshStatus: 'scheduled',
      },
    });

    return { mutationId: mutation.id, newVersion };
  });
}

export function mapLifecycleToMutationType(action: 'confirm' | 'dismiss' | 'resolve' | 'reopen'): string {
  switch (action) {
    case 'confirm':
      return 'user_confirm';
    case 'dismiss':
      return 'user_dismiss';
    case 'resolve':
      return 'user_resolve';
    case 'reopen':
      return 'user_reopen';
    default:
      return 'user_action';
  }
}
