import type { PrivacyActionType } from '@prisma/client';
import { prisma } from '@life-os/database';
import { redactDocumentSummary, redactNoteBody } from './redaction-service.js';

export async function createPrivacyAction(input: {
  userId: string;
  actionType: PrivacyActionType;
  targetEntityType: string;
  targetEntityId: string | null;
  reason?: string | null;
}) {
  return prisma.privacyAction.create({
    data: {
      userId: input.userId,
      actionType: input.actionType,
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId ?? undefined,
      reason: input.reason ?? undefined,
      status: 'REQUESTED',
    },
  });
}

export async function executePrivacyAction(actionId: string, userId: string): Promise<{ ok: boolean; summary: Record<string, unknown> }> {
  const action = await prisma.privacyAction.findFirst({ where: { id: actionId, userId } });
  if (!action) return { ok: false, summary: { error: 'not_found' } };

  await prisma.privacyAction.update({
    where: { id: actionId },
    data: { status: 'RUNNING' },
  });

  try {
    const summary = await runActionBody(action);
    await prisma.privacyAction.update({
      where: { id: actionId },
      data: {
        status: 'COMPLETED',
        executedAt: new Date(),
        summaryJson: JSON.stringify(summary),
      },
    });
    return { ok: true, summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    await prisma.privacyAction.update({
      where: { id: actionId },
      data: {
        status: 'FAILED',
        executedAt: new Date(),
        summaryJson: JSON.stringify({ error: msg }),
      },
    });
    return { ok: false, summary: { error: msg } };
  }
}

async function runActionBody(action: {
  actionType: PrivacyActionType;
  targetEntityType: string;
  targetEntityId: string | null;
  userId: string;
}): Promise<Record<string, unknown>> {
  const { actionType, targetEntityType, targetEntityId, userId } = action;
  if (!targetEntityId) throw new Error('targetEntityId required');

  if (actionType === 'DELETE') {
    if (targetEntityType === 'Note') {
      await prisma.note.deleteMany({ where: { id: targetEntityId, userId } });
      return { deleted: 'Note', id: targetEntityId };
    }
    if (targetEntityType === 'Event') {
      await prisma.event.deleteMany({ where: { id: targetEntityId, userId } });
      return { deleted: 'Event', id: targetEntityId };
    }
    if (targetEntityType === 'Task') {
      await prisma.task.deleteMany({ where: { id: targetEntityId, userId } });
      return { deleted: 'Task', id: targetEntityId };
    }
    throw new Error(`DELETE not supported for ${targetEntityType}`);
  }

  if (actionType === 'ARCHIVE') {
    const now = new Date();
    if (targetEntityType === 'Note') {
      const n = await prisma.note.updateMany({ where: { id: targetEntityId, userId }, data: { archivedAt: now } });
      return { archived: 'Note', count: n.count };
    }
    if (targetEntityType === 'Event') {
      const n = await prisma.event.updateMany({ where: { id: targetEntityId, userId }, data: { archivedAt: now } });
      return { archived: 'Event', count: n.count };
    }
    if (targetEntityType === 'Task') {
      const n = await prisma.task.updateMany({ where: { id: targetEntityId, userId }, data: { archivedAt: now } });
      return { archived: 'Task', count: n.count };
    }
    throw new Error(`ARCHIVE not supported for ${targetEntityType}`);
  }

  if (actionType === 'REDACT') {
    if (targetEntityType === 'Note') {
      const r = await redactNoteBody(userId, targetEntityId, 'strip');
      return { redacted: 'Note', ok: r.ok };
    }
    if (targetEntityType === 'Document') {
      const r = await redactDocumentSummary(userId, targetEntityId);
      return { redacted: 'Document', ok: r.ok };
    }
    throw new Error(`REDACT not supported for ${targetEntityType}`);
  }

  throw new Error(`Action ${actionType} must be queued separately`);
}

/** Create and immediately execute (MVP synchronous executor). */
export async function createAndExecutePrivacyAction(input: {
  userId: string;
  actionType: PrivacyActionType;
  targetEntityType: string;
  targetEntityId: string | null;
  reason?: string | null;
}) {
  const row = await createPrivacyAction(input);
  const result = await executePrivacyAction(row.id, input.userId);
  return { action: await prisma.privacyAction.findUniqueOrThrow({ where: { id: row.id } }), result };
}
