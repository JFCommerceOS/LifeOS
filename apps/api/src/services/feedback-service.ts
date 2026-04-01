import { prisma } from '@life-os/database';
import { writeAudit } from '../lib/audit.js';
import {
  applyObligationLifecycle,
  InvalidLifecycleTransitionError,
} from './continuity-obligation-lifecycle.js';
import { applyMemoryCorrection, recordMemoryConfirmation } from './memory-confirmation-service.js';
import { runSuggestionAction, runSuggestionResolveLinkedObligation } from './suggestion-action-runner.js';

export type StructuredFeedbackInput = {
  userId: string;
  linkedEntityType: 'SUGGESTION' | 'OBLIGATION' | 'MEMORY_NODE';
  linkedEntityId: string;
  feedbackType: 'CONFIRM' | 'DISMISS' | 'RESOLVE' | 'CORRECT' | 'FALSE_POSITIVE';
  note?: string | null;
  surface?: string | null;
  correctionNote?: string | null;
  correctedFields?: { summary?: string; confidence?: number } | null;
};

export class FeedbackApplyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'FeedbackApplyError';
  }
}

export async function applyStructuredFeedback(input: StructuredFeedbackInput): Promise<{
  signal: Awaited<ReturnType<typeof prisma.feedbackSignal.create>>;
  targetSummary: Record<string, unknown>;
  continuityEffect: Record<string, unknown>;
}> {
  const {
    userId,
    linkedEntityType,
    linkedEntityId,
    feedbackType,
    note,
    surface,
    correctionNote,
    correctedFields,
  } = input;

  const trace = { surface: surface ?? undefined, feedbackType };

  try {
    if (linkedEntityType === 'OBLIGATION') {
      const existing = await prisma.obligation.findFirst({
        where: { id: linkedEntityId, userId },
      });
      if (!existing) throw new FeedbackApplyError('Obligation not found', 'NOT_FOUND');

      if (feedbackType === 'CORRECT') {
        const signal = await prisma.feedbackSignal.create({
          data: {
            userId,
            feedbackType,
            linkedEntityType: 'OBLIGATION',
            linkedEntityId,
            surface: surface ?? undefined,
            note: note ?? undefined,
            useful: null,
          },
        });
        await writeAudit(userId, 'feedback.obligation_note', {
          entityType: 'Obligation',
          entityId: linkedEntityId,
          meta: { note, surface },
        });
        return {
          signal,
          targetSummary: { obligationId: linkedEntityId, status: existing.status },
          continuityEffect: { effect: 'note_logged' },
        };
      }

      const map: Partial<
        Record<
          StructuredFeedbackInput['feedbackType'],
          'confirm' | 'dismiss' | 'resolve' | 'reopen'
        >
      > = {
        CONFIRM: 'confirm',
        DISMISS: 'dismiss',
        RESOLVE: 'resolve',
        FALSE_POSITIVE: 'dismiss',
      };
      const action = map[feedbackType];
      if (!action) throw new FeedbackApplyError('Unsupported feedback for obligation', 'BAD_REQUEST');

      const ob = await applyObligationLifecycle({
        userId,
        obligationId: linkedEntityId,
        existing,
        action,
        dismissNote: action === 'dismiss' ? note : undefined,
      });

      const signal = await prisma.feedbackSignal.create({
        data: {
          userId,
          feedbackType,
          linkedEntityType: 'OBLIGATION',
          linkedEntityId,
          surface: surface ?? undefined,
          note: note ?? undefined,
          useful: feedbackType === 'CONFIRM' ? true : feedbackType === 'FALSE_POSITIVE' ? false : null,
        },
      });

      await writeAudit(userId, 'feedback.apply', {
        entityType: 'Obligation',
        entityId: linkedEntityId,
        meta: { feedbackType, surface },
      });
      return {
        signal,
        targetSummary: { obligation: ob },
        continuityEffect: {
          status: ob.status,
          suppressionUntil: ob.suppressionUntil,
          dismissedCount: ob.dismissedCount,
        },
      };
    }

    if (linkedEntityType === 'SUGGESTION') {
      if (feedbackType === 'RESOLVE') {
        const { suggestion, feedbackSignal } = await runSuggestionResolveLinkedObligation({
          userId,
          suggestionId: linkedEntityId,
          note: note ?? undefined,
          trace,
        });
        return {
          signal: feedbackSignal,
          targetSummary: { suggestion },
          continuityEffect: { state: suggestion.state, linkedObligationResolved: true },
        };
      }
      if (feedbackType === 'CORRECT') {
        throw new FeedbackApplyError('Use memory correction for corrections', 'BAD_REQUEST');
      }

      const actionMap: Partial<
        Record<StructuredFeedbackInput['feedbackType'], 'accept' | 'dismiss' | 'false_positive'>
      > = {
        CONFIRM: 'accept',
        DISMISS: 'dismiss',
        FALSE_POSITIVE: 'false_positive',
      };
      const sa = actionMap[feedbackType];
      if (!sa) throw new FeedbackApplyError('Unsupported feedback for suggestion', 'BAD_REQUEST');

      const { suggestion, feedbackSignal } = await runSuggestionAction({
        userId,
        suggestionId: linkedEntityId,
        action: sa,
        note: note ?? undefined,
        trace,
      });
      return {
        signal: feedbackSignal,
        targetSummary: { suggestion },
        continuityEffect: { state: suggestion?.state },
      };
    }

    if (linkedEntityType === 'MEMORY_NODE') {
      if (feedbackType === 'CORRECT') {
        const cn = correctionNote?.trim();
        if (!cn) throw new FeedbackApplyError('correctionNote required', 'BAD_REQUEST');
        await applyMemoryCorrection({
          userId,
          memoryNodeId: linkedEntityId,
          correctionNote: cn,
          newSummary: correctedFields?.summary,
          correctedConfidence: correctedFields?.confidence,
        });
        const signal = await prisma.feedbackSignal.create({
          data: {
            userId,
            feedbackType: 'CORRECT',
            linkedEntityType: 'MEMORY_NODE',
            linkedEntityId,
            surface: surface ?? undefined,
            note: note ?? undefined,
            useful: null,
          },
        });
        await writeAudit(userId, 'feedback.memory_correct', {
          entityType: 'MemoryNode',
          entityId: linkedEntityId,
          meta: { surface },
        });
        return {
          signal,
          targetSummary: { memoryNodeId: linkedEntityId, corrected: true },
          continuityEffect: { confidenceAdjusted: true },
        };
      }
      if (feedbackType === 'CONFIRM') {
        await recordMemoryConfirmation({
          userId,
          memoryNodeId: linkedEntityId,
          confirmedByUser: true,
        });
        const signal = await prisma.feedbackSignal.create({
          data: {
            userId,
            feedbackType: 'CONFIRM',
            linkedEntityType: 'MEMORY_NODE',
            linkedEntityId,
            surface: surface ?? undefined,
            note: note ?? undefined,
            useful: true,
          },
        });
        await writeAudit(userId, 'feedback.memory_confirm', {
          entityType: 'MemoryNode',
          entityId: linkedEntityId,
          meta: { surface },
        });
        return {
          signal,
          targetSummary: { memoryNodeId: linkedEntityId, confirmed: true },
          continuityEffect: { strengthIncreased: true },
        };
      }
      if (feedbackType === 'DISMISS' || feedbackType === 'FALSE_POSITIVE') {
        const node = await prisma.memoryNode.findFirst({
          where: { id: linkedEntityId, userId },
        });
        if (!node) throw new FeedbackApplyError('Memory node not found', 'NOT_FOUND');
        await prisma.memoryNode.update({
          where: { id: linkedEntityId },
          data: {
            lastDismissedAt: new Date(),
            confidence: Math.max(0, node.confidence - 0.08),
            strengthScore: Math.max(0, node.strengthScore - 0.06),
          },
        });
        const signal = await prisma.feedbackSignal.create({
          data: {
            userId,
            feedbackType,
            linkedEntityType: 'MEMORY_NODE',
            linkedEntityId,
            surface: surface ?? undefined,
            note: note ?? undefined,
            useful: false,
          },
        });
        await writeAudit(userId, 'feedback.memory_downgrade', {
          entityType: 'MemoryNode',
          entityId: linkedEntityId,
          meta: { feedbackType, surface },
        });
        return {
          signal,
          targetSummary: { memoryNodeId: linkedEntityId, downgraded: true },
          continuityEffect: { suppressed: true },
        };
      }
      throw new FeedbackApplyError('Unsupported feedback for memory', 'BAD_REQUEST');
    }

    throw new FeedbackApplyError('Invalid linkedEntityType', 'BAD_REQUEST');
  } catch (e) {
    if (e instanceof InvalidLifecycleTransitionError) {
      throw new FeedbackApplyError(e.message, 'INVALID_TRANSITION');
    }
    if (e instanceof FeedbackApplyError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NOT_FOUND') throw new FeedbackApplyError('Target not found', 'NOT_FOUND');
    if (msg === 'NO_LINKED_OBLIGATION') {
      throw new FeedbackApplyError('Suggestion has no linked obligation to resolve', 'BAD_REQUEST');
    }
    if (msg === 'RESOLVE_INVALID') {
      throw new FeedbackApplyError('Cannot resolve in current state', 'INVALID_TRANSITION');
    }
    throw e;
  }
}
