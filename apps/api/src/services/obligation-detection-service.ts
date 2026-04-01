import type { ExtractedFact, SignalEnvelope } from '@prisma/client';
import { prisma } from '@life-os/database';
import { upsertMemoryNodeForRef } from './continuity-memory-graph.js';
import type { NormalizedFields } from './signal-normalization-service.js';

export type ObligationDetectionResult = {
  count: number;
  obligationIds: string[];
  factIdsByObligationId: Record<string, string[]>;
};

function parsePayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function primaryPersonName(facts: ExtractedFact[]): string | null {
  const p = facts.find((f) => f.factType === 'PERSON_MENTION');
  if (!p) return null;
  try {
    const j = JSON.parse(p.factValueJson) as { name?: string };
    return typeof j.name === 'string' ? j.name : null;
  } catch {
    return null;
  }
}

function deadlineDue(facts: ExtractedFact[]): Date | null {
  const d = facts.find((f) => f.factType === 'DEADLINE_REFERENCE');
  if (!d) return null;
  try {
    const j = JSON.parse(d.factValueJson) as { inferredIso?: string | null };
    if (j.inferredIso) return new Date(j.inferredIso);
  } catch {
    /* ignore */
  }
  return null;
}

function avgConfidence(fs: ExtractedFact[]): number {
  if (!fs.length) return 0.5;
  return fs.reduce((s, f) => s + f.confidence, 0) / fs.length;
}

/**
 * Sprint 02 — obligations from extracted facts + source timing (not raw keyword lists).
 */
export async function createObligationsFromPipeline(
  envelope: SignalEnvelope,
  _normalized: NormalizedFields,
  facts: ExtractedFact[],
): Promise<ObligationDetectionResult> {
  const payload = parsePayload(envelope.rawPayloadJson);
  const actionable = facts.filter((f) =>
    [
      'FOLLOW_UP_CUE',
      'REVIEW_CUE',
      'PROMISE_CUE',
      'DEADLINE_REFERENCE',
      'EVENT_PREP',
      'DATE_REFERENCE',
    ].includes(f.factType),
  );

  const usable = actionable.filter(
    (f) => f.factType !== 'DATE_REFERENCE' || actionable.some((a) => a.factType === 'DEADLINE_REFERENCE'),
  );

  const factIdsByObligationId: Record<string, string[]> = {};
  const obligationIds: string[] = [];

  const pushOb = async (data: {
    title: string;
    obligationType: string;
    reasonSummary: string;
    confidence: number;
    dueAt: Date | null;
    sourceEntityType: string | null;
    sourceEntityId: string | null;
    linkedFactIds: string[];
  }) => {
    if (data.sourceEntityType && data.sourceEntityId) {
      const existing = await prisma.obligation.findFirst({
        where: {
          userId: envelope.userId,
          sourceEntityType: data.sourceEntityType,
          sourceEntityId: data.sourceEntityId,
          obligationType: data.obligationType,
          status: { in: ['open', 'confirmed', 'reopened'] },
        },
      });
      if (existing) {
        await prisma.obligation.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            reasonSummary: data.reasonSummary,
            dueAt: data.dueAt,
            confidence: data.confidence,
            sourceSignalId: envelope.id,
          },
        });
        obligationIds.push(existing.id);
        factIdsByObligationId[existing.id] = data.linkedFactIds;
        return;
      }
    }

    const ob = await prisma.obligation.create({
      data: {
        userId: envelope.userId,
        title: data.title,
        obligationType: data.obligationType,
        reasonSummary: data.reasonSummary,
        confidence: data.confidence,
        dueAt: data.dueAt,
        sourceSignalId: envelope.id,
        sourceEntityType: data.sourceEntityType,
        sourceEntityId: data.sourceEntityId,
        description: `Signal ${envelope.signalType}`,
      },
    });
    await upsertMemoryNodeForRef({
      userId: envelope.userId,
      nodeType: 'OBLIGATION',
      refEntityType: 'Obligation',
      refEntityId: ob.id,
      summary: data.title,
      confidence: data.confidence,
    });
    obligationIds.push(ob.id);
    factIdsByObligationId[ob.id] = data.linkedFactIds;
  };

  if (envelope.signalType === 'NOTE_CAPTURE') {
    const noteId = typeof payload.noteId === 'string' ? payload.noteId : null;
    if (!noteId || usable.length === 0) {
      return { count: 0, obligationIds: [], factIdsByObligationId: {} };
    }

    const person = primaryPersonName(facts);
    const due = deadlineDue(facts);
    const hasFollow = usable.some((f) => f.factType === 'FOLLOW_UP_CUE');
    const hasReview = usable.some((f) => f.factType === 'REVIEW_CUE');
    const hasPromise = usable.some((f) => f.factType === 'PROMISE_CUE');
    const hasDeadline = usable.some((f) => f.factType === 'DEADLINE_REFERENCE');
    const hasActionable = hasFollow || hasReview || hasPromise || hasDeadline;

    if (!hasActionable) {
      return { count: 0, obligationIds: [], factIdsByObligationId: {} };
    }

    let title = 'Follow up';
    if (hasDeadline && !hasFollow && !hasReview && !hasPromise) {
      title = 'Deadline mentioned';
    } else if (person) title = `Follow up with ${person}`;
    else if (hasReview) title = 'Review item';
    else if (hasPromise) title = 'Honor commitment';

    const dl = facts.find((f) => f.factType === 'DEADLINE_REFERENCE');
    if (dl && title.startsWith('Follow up')) {
      try {
        const j = JSON.parse(dl.factValueJson) as { token?: string };
        if (j.token) title = `${title} (${j.token})`;
      } catch {
        /* ignore */
      }
    }

    let obType = 'FOLLOW_UP';
    if (hasReview && !hasFollow) obType = 'REVIEW';
    if (hasPromise) obType = 'PROMISE';
    if (hasDeadline && due) obType = 'DEADLINE';

    const linked = usable;
    const reasonSummary = linked.map((f) => f.factType).join(', ');

    await pushOb({
      title,
      obligationType: obType,
      reasonSummary,
      confidence: avgConfidence(linked),
      dueAt: due,
      sourceEntityType: 'Note',
      sourceEntityId: noteId,
      linkedFactIds: linked.map((f) => f.id),
    });

    return { count: obligationIds.length, obligationIds, factIdsByObligationId };
  }

  if (envelope.signalType === 'VOICE_NOTE') {
    const noteId = typeof payload.noteId === 'string' ? payload.noteId : null;
    if (!noteId || usable.length === 0) {
      return { count: 0, obligationIds: [], factIdsByObligationId: {} };
    }

    const transcriptConfidence =
      typeof payload.transcriptConfidence === 'number' ? payload.transcriptConfidence : 0.5;
    const voiceCommitConfirmed = payload.voiceCommitConfirmed === true;
    const weak = transcriptConfidence < 0.55;
    if (weak && !voiceCommitConfirmed) {
      return { count: 0, obligationIds: [], factIdsByObligationId: {} };
    }

    const person = primaryPersonName(facts);
    const due = deadlineDue(facts);
    const hasFollow = usable.some((f) => f.factType === 'FOLLOW_UP_CUE');
    const hasReview = usable.some((f) => f.factType === 'REVIEW_CUE');
    const hasPromise = usable.some((f) => f.factType === 'PROMISE_CUE');
    const hasDeadline = usable.some((f) => f.factType === 'DEADLINE_REFERENCE');
    const hasActionable = hasFollow || hasReview || hasPromise || hasDeadline;

    if (!hasActionable) {
      return { count: 0, obligationIds: [], factIdsByObligationId: {} };
    }

    let title = 'Follow up';
    if (hasDeadline && !hasFollow && !hasReview && !hasPromise) {
      title = 'Deadline mentioned';
    } else if (person) title = `Follow up with ${person}`;
    else if (hasReview) title = 'Review item';
    else if (hasPromise) title = 'Honor commitment';

    const dl = facts.find((f) => f.factType === 'DEADLINE_REFERENCE');
    if (dl && title.startsWith('Follow up')) {
      try {
        const j = JSON.parse(dl.factValueJson) as { token?: string };
        if (j.token) title = `${title} (${j.token})`;
      } catch {
        /* ignore */
      }
    }

    let obType = 'FOLLOW_UP';
    if (hasReview && !hasFollow) obType = 'REVIEW';
    if (hasPromise) obType = 'PROMISE';
    if (hasDeadline && due) obType = 'DEADLINE';

    const linked = usable;
    const reasonSummary = `From voice note: ${linked.map((f) => f.factType).join(', ')}`;

    const blendedConfidence = Math.min(avgConfidence(linked), transcriptConfidence);

    await pushOb({
      title,
      obligationType: obType,
      reasonSummary,
      confidence: blendedConfidence,
      dueAt: due,
      sourceEntityType: 'Note',
      sourceEntityId: noteId,
      linkedFactIds: linked.map((f) => f.id),
    });

    return { count: obligationIds.length, obligationIds, factIdsByObligationId };
  }

  if (envelope.signalType === 'TASK_ITEM') {
    const taskId = typeof payload.taskId === 'string' ? payload.taskId : null;
    if (!taskId) return { count: 0, obligationIds: [], factIdsByObligationId: {} };

    const titleStr = typeof payload.title === 'string' ? payload.title : 'Task';
    const dueStr = typeof payload.dueAt === 'string' ? payload.dueAt : null;
    const dueAt = dueStr ? new Date(dueStr) : deadlineDue(facts);

    if (!dueAt && usable.length === 0) {
      return { count: 0, obligationIds: [], factIdsByObligationId: {} };
    }

    const linked = facts.filter((f) => ['DEADLINE_REFERENCE', 'FOLLOW_UP_CUE', 'DATE_REFERENCE'].includes(f.factType));
    await pushOb({
      title: dueAt ? `Complete: ${titleStr}` : `Task follow-through: ${titleStr}`,
      obligationType: 'TASK_DEADLINE',
      reasonSummary: dueAt ? `Due ${dueAt.toISOString()}` : 'Task capture follow-up',
      confidence: avgConfidence(linked.length ? linked : facts),
      dueAt,
      sourceEntityType: 'Task',
      sourceEntityId: taskId,
      linkedFactIds: linked.map((f) => f.id),
    });

    return { count: obligationIds.length, obligationIds, factIdsByObligationId };
  }

  if (envelope.signalType === 'CALENDAR_EVENT') {
    const eventId = typeof payload.eventId === 'string' ? payload.eventId : null;
    if (!eventId) return { count: 0, obligationIds: [], factIdsByObligationId: {} };

    const prep = usable.filter((f) => f.factType === 'EVENT_PREP');
    const titleStr = typeof payload.title === 'string' ? payload.title : 'Event';
    const startsAt = typeof payload.startsAt === 'string' ? new Date(payload.startsAt) : null;

    if (prep.length > 0 && startsAt) {
      const prepStart = new Date(startsAt.getTime() - 3600000);
      const linked = prep;
      await pushOb({
        title: `Prep: ${titleStr}`,
        obligationType: 'EVENT_PREP',
        reasonSummary: 'Event prep cue detected in event text',
        confidence: avgConfidence(linked),
        dueAt: prepStart,
        sourceEntityType: 'Event',
        sourceEntityId: eventId,
        linkedFactIds: linked.map((f) => f.id),
      });
    }

    return { count: obligationIds.length, obligationIds, factIdsByObligationId };
  }

  return { count: 0, obligationIds: [], factIdsByObligationId: {} };
}
