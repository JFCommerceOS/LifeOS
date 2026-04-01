import type { Obligation, ObligationStatus } from '@prisma/client';
import { prisma } from '@life-os/database';
import { removeDailyBriefItemsForSuggestion } from '../lib/brief-items.js';

const SUPPRESS_MS = 24 * 60 * 60 * 1000;

export class InvalidLifecycleTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLifecycleTransitionError';
  }
}

export type ObligationLifecycleAction = 'confirm' | 'dismiss' | 'resolve' | 'reopen';

/** Update canonical memory node for an obligation after lifecycle changes (best-effort). */
export async function touchObligationMemoryNode(
  userId: string,
  obligationId: string,
  kind: 'confirmed' | 'dismissed' | 'resolved' | 'reopened',
): Promise<void> {
  const now = new Date();
  const base = { lastObservedAt: now };
  if (kind === 'confirmed') {
    await prisma.memoryNode.updateMany({
      where: { userId, refEntityType: 'Obligation', refEntityId: obligationId },
      data: {
        ...base,
        lastConfirmedAt: now,
        strengthScore: { increment: 0.05 },
        status: 'active',
      },
    });
    return;
  }
  if (kind === 'dismissed') {
    await prisma.memoryNode.updateMany({
      where: { userId, refEntityType: 'Obligation', refEntityId: obligationId },
      data: {
        ...base,
        lastDismissedAt: now,
      },
    });
    return;
  }
  if (kind === 'resolved') {
    await prisma.memoryNode.updateMany({
      where: { userId, refEntityType: 'Obligation', refEntityId: obligationId },
      data: {
        ...base,
        lastResolvedAt: now,
        status: 'resolved',
      },
    });
    return;
  }
  await prisma.memoryNode.updateMany({
    where: { userId, refEntityType: 'Obligation', refEntityId: obligationId },
    data: { ...base, status: 'active' },
  });
}

export async function applyObligationLifecycle(args: {
  userId: string;
  obligationId: string;
  existing: { status: ObligationStatus };
  action: ObligationLifecycleAction;
  /** Optional user note stored on dismiss (Sprint 04). */
  dismissNote?: string | null;
}): Promise<Obligation> {
  const now = new Date();
  const { userId, obligationId, existing, action, dismissNote } = args;

  if (action === 'confirm') {
    if (existing.status === 'resolved' || existing.status === 'dismissed') {
      throw new InvalidLifecycleTransitionError('Cannot confirm from resolved or dismissed');
    }
    await prisma.obligation.update({
      where: { id: obligationId },
      data: { status: 'confirmed', lastConfirmedAt: now },
    });
    await touchObligationMemoryNode(userId, obligationId, 'confirmed');
    return prisma.obligation.findFirstOrThrow({ where: { id: obligationId } });
  }

  if (action === 'dismiss') {
    const suppressionUntil = new Date(now.getTime() + SUPPRESS_MS);
    await prisma.obligation.update({
      where: { id: obligationId },
      data: {
        status: 'dismissed',
        lastDismissedAt: now,
        suppressionUntil,
        dismissedCount: { increment: 1 },
        dismissalReasonNote: dismissNote?.trim() ? dismissNote.trim() : undefined,
      },
    });
    const toDismiss = await prisma.suggestion.findMany({
      where: { userId, linkedObligationId: obligationId, state: { in: ['pending', 'snoozed'] } },
      select: { id: true },
    });
    for (const s of toDismiss) {
      await removeDailyBriefItemsForSuggestion(userId, s.id);
    }
    await prisma.suggestion.updateMany({
      where: { userId, linkedObligationId: obligationId, state: { in: ['pending', 'snoozed'] } },
      data: { state: 'dismissed', snoozedUntil: null },
    });
    await touchObligationMemoryNode(userId, obligationId, 'dismissed');
    return prisma.obligation.findFirstOrThrow({ where: { id: obligationId } });
  }

  if (action === 'resolve') {
    await prisma.obligation.update({
      where: { id: obligationId },
      data: { status: 'resolved', lastResolvedAt: now, suppressionUntil: null },
    });
    const toClose = await prisma.suggestion.findMany({
      where: { userId, linkedObligationId: obligationId, state: { in: ['pending', 'snoozed'] } },
      select: { id: true },
    });
    for (const s of toClose) {
      await removeDailyBriefItemsForSuggestion(userId, s.id);
    }
    await prisma.suggestion.updateMany({
      where: { userId, linkedObligationId: obligationId, state: { in: ['pending', 'snoozed'] } },
      data: { state: 'accepted', actedOnAt: now, snoozedUntil: null },
    });
    await touchObligationMemoryNode(userId, obligationId, 'resolved');
    return prisma.obligation.findFirstOrThrow({ where: { id: obligationId } });
  }

  // reopen
  if (existing.status !== 'dismissed' && existing.status !== 'resolved') {
    throw new InvalidLifecycleTransitionError('Reopen is only valid for dismissed or resolved obligations');
  }
  await prisma.obligation.update({
    where: { id: obligationId },
    data: {
      status: 'reopened',
      suppressionUntil: null,
    },
  });
  await touchObligationMemoryNode(userId, obligationId, 'reopened');
  return prisma.obligation.findFirstOrThrow({ where: { id: obligationId } });
}
