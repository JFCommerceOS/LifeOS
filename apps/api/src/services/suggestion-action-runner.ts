import { prisma } from '@life-os/database';
import { writeAudit } from '../lib/audit.js';
import { removeDailyBriefItemsForSuggestion } from '../lib/brief-items.js';
import {
  applyObligationLifecycle,
  InvalidLifecycleTransitionError,
} from './continuity-obligation-lifecycle.js';
import { recordPreferenceInferenceSignal } from './profile-inference-service.js';

const DEFAULT_SNOOZE_MS = 24 * 60 * 60 * 1000;

export type SuggestionActionKind = 'accept' | 'dismiss' | 'snooze' | 'false_positive';

export type SuggestionActionTrace = {
  surface?: string;
  feedbackType?: string;
};

export async function createSuggestionFeedbackSignal(args: {
  userId: string;
  suggestionId: string;
  useful: boolean | null;
  note?: string | null;
  trace?: SuggestionActionTrace;
}) {
  return prisma.feedbackSignal.create({
    data: {
      userId: args.userId,
      suggestionId: args.suggestionId,
      useful: args.useful,
      note: args.note ?? undefined,
      feedbackType: args.trace?.feedbackType,
      linkedEntityType: 'SUGGESTION',
      linkedEntityId: args.suggestionId,
      surface: args.trace?.surface,
    },
  });
}

/** Shared suggestion actions for HTTP route and structured feedback (Sprint 04). */
export async function runSuggestionAction(args: {
  userId: string;
  suggestionId: string;
  action: SuggestionActionKind;
  note?: string;
  snoozeUntilRaw?: string;
  trace?: SuggestionActionTrace;
}): Promise<{
  suggestion: NonNullable<Awaited<ReturnType<typeof prisma.suggestion.findFirst>>>;
  feedbackSignal: Awaited<ReturnType<typeof createSuggestionFeedbackSignal>>;
}> {
  const { userId, suggestionId: id, action, note, snoozeUntilRaw, trace } = args;
  const existing = await prisma.suggestion.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('NOT_FOUND');

  const now = new Date();

  if (action === 'snooze') {
    if (existing.state !== 'pending' && existing.state !== 'snoozed') {
      throw new Error('SNOOZE_NOT_ALLOWED');
    }
    let snoozeUntil: Date;
    if (snoozeUntilRaw !== undefined && snoozeUntilRaw !== '') {
      snoozeUntil = new Date(snoozeUntilRaw);
      if (Number.isNaN(snoozeUntil.getTime())) throw new Error('INVALID_SNOOZE');
      if (snoozeUntil.getTime() <= Date.now()) throw new Error('SNOOZE_PAST');
    } else {
      snoozeUntil = new Date(Date.now() + DEFAULT_SNOOZE_MS);
    }

    const suggestion = await prisma.suggestion.update({
      where: { id },
      data: { state: 'snoozed', snoozedUntil: snoozeUntil, lastActionAt: now },
    });
    const feedbackSignal = await createSuggestionFeedbackSignal({
      userId,
      suggestionId: id,
      useful: null,
      note,
      trace: { ...trace, feedbackType: trace?.feedbackType ?? 'DISMISS' },
    });
    await writeAudit(userId, 'suggestion.action', {
      entityType: 'Suggestion',
      entityId: id,
      meta: { action: 'snooze', snoozeUntil: snoozeUntil.toISOString(), surface: trace?.surface },
    });
    await removeDailyBriefItemsForSuggestion(userId, id);
    return { suggestion, feedbackSignal };
  }

  if (action === 'false_positive') {
    if (existing.state !== 'pending' && existing.state !== 'snoozed') {
      throw new Error('FALSE_POSITIVE_NOT_ALLOWED');
    }
    const suggestion = await prisma.suggestion.update({
      where: { id },
      data: { state: 'false_positive', snoozedUntil: null, lastActionAt: now },
    });
    const feedbackSignal = await createSuggestionFeedbackSignal({
      userId,
      suggestionId: id,
      useful: false,
      note,
      trace: { ...trace, feedbackType: 'FALSE_POSITIVE' },
    });
    await prisma.dismissalRule.create({
      data: {
        userId,
        patternJson: JSON.stringify({ suggestionId: id, kind: 'false_positive' }),
        reason: note ?? 'false_positive',
      },
    });
    await writeAudit(userId, 'suggestion.action', {
      entityType: 'Suggestion',
      entityId: id,
      meta: { action: 'false_positive', surface: trace?.surface },
    });
    await removeDailyBriefItemsForSuggestion(userId, id);
    return { suggestion, feedbackSignal };
  }

  if (existing.state !== 'pending') {
    throw new Error('ACTION_NOT_ALLOWED');
  }

  if (action === 'accept') {
    const suggestion = await prisma.suggestion.update({
      where: { id },
      data: { state: 'accepted', snoozedUntil: null, lastActionAt: now },
    });
    const feedbackSignal = await createSuggestionFeedbackSignal({
      userId,
      suggestionId: id,
      useful: true,
      note,
      trace: { ...trace, feedbackType: trace?.feedbackType ?? 'CONFIRM' },
    });
    await writeAudit(userId, 'suggestion.action', {
      entityType: 'Suggestion',
      entityId: id,
      meta: { action: 'accept', surface: trace?.surface },
    });
    await removeDailyBriefItemsForSuggestion(userId, id);
    return { suggestion, feedbackSignal };
  }

  // dismiss
  const suggestion = await prisma.suggestion.update({
    where: { id },
    data: { state: 'dismissed', snoozedUntil: null, lastActionAt: now },
  });
  const feedbackSignalDismiss = await createSuggestionFeedbackSignal({
    userId,
    suggestionId: id,
    useful: false,
    note,
    trace: { ...trace, feedbackType: trace?.feedbackType ?? 'DISMISS' },
  });
  await prisma.dismissalRule.create({
    data: {
      userId,
      patternJson: JSON.stringify({ suggestionId: id }),
      reason: note ?? 'user_dismissed',
    },
  });
  await writeAudit(userId, 'suggestion.action', {
    entityType: 'Suggestion',
    entityId: id,
    meta: { action: 'dismiss', surface: trace?.surface },
  });
  await removeDailyBriefItemsForSuggestion(userId, id);
  void recordPreferenceInferenceSignal({
    userId,
    signalType:
      existing.confidence < 0.45 ? 'dismiss_low_confidence_suggestion' : 'suggestion_dismiss',
    linkedEntityType: 'Suggestion',
    linkedEntityId: id,
    signalValue: { confidence: existing.confidence },
  }).catch(() => undefined);
  return { suggestion, feedbackSignal: feedbackSignalDismiss };
}

/** Resolve linked obligation when user marks suggestion resolved (Sprint 04). */
export async function runSuggestionResolveLinkedObligation(args: {
  userId: string;
  suggestionId: string;
  note?: string;
  trace?: SuggestionActionTrace;
}): Promise<{
  suggestion: NonNullable<Awaited<ReturnType<typeof prisma.suggestion.findFirst>>>;
  feedbackSignal: Awaited<ReturnType<typeof createSuggestionFeedbackSignal>>;
}> {
  const { userId, suggestionId: id, note, trace } = args;
  const existing = await prisma.suggestion.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('NOT_FOUND');
  if (!existing.linkedObligationId) throw new Error('NO_LINKED_OBLIGATION');

  const ob = await prisma.obligation.findFirst({
    where: { id: existing.linkedObligationId, userId },
  });
  if (!ob) throw new Error('OBLIGATION_NOT_FOUND');

  try {
    await applyObligationLifecycle({
      userId,
      obligationId: ob.id,
      existing: ob,
      action: 'resolve',
    });
  } catch (e) {
    if (e instanceof InvalidLifecycleTransitionError) throw new Error('RESOLVE_INVALID');
    throw e;
  }

  const feedbackSignal = await createSuggestionFeedbackSignal({
    userId,
    suggestionId: id,
    useful: true,
    note,
    trace: { ...trace, feedbackType: 'RESOLVE' },
  });
  await writeAudit(userId, 'suggestion.action', {
    entityType: 'Suggestion',
    entityId: id,
    meta: { action: 'resolve_linked_obligation', surface: trace?.surface },
  });
  await removeDailyBriefItemsForSuggestion(userId, id);
  const suggestion = await prisma.suggestion.findFirst({ where: { id, userId } });
  if (!suggestion) throw new Error('NOT_FOUND');
  return { suggestion, feedbackSignal };
}
