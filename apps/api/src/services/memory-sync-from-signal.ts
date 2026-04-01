import type { MemoryNodeType, SignalType } from '@prisma/client';
import { prisma } from '@life-os/database';
import { getDecayRuleForNodeType } from './memory-decay-service.js';

export function signalTypeToMemoryNodeType(signalType: SignalType): MemoryNodeType {
  const map: Partial<Record<SignalType, MemoryNodeType>> = {
    NOTE_CAPTURE: 'NOTE',
    DOCUMENT_INPUT: 'DOCUMENT',
    REMINDER_INPUT: 'TASK',
    TASK_ITEM: 'TASK',
    CALENDAR_EVENT: 'EVENT',
    PLACE_EVENT: 'PLACE',
    VOICE_CAPTURE: 'NOTE',
    CORRECTION_INPUT: 'PREFERENCE',
    ROUTINE_GOAL: 'ROUTINE',
    SCREEN_TIME_SUMMARY: 'PREFERENCE',
    RELATIONSHIP_SIGNAL: 'PERSON',
    LANGUAGE_PREFERENCE_SIGNAL: 'PREFERENCE',
    SURFACE_INTERACTION_SIGNAL: 'PREFERENCE',
    EMAIL_THREAD_METADATA: 'NOTE',
  };
  return map[signalType] ?? 'NOTE';
}

/**
 * After a signal finishes processing, materialize an evidence-layer memory node + evidence links.
 * Idempotent per signal (one memory cluster per signalId).
 */
export async function syncMemoryFromProcessedSignal(signalId: string): Promise<void> {
  try {
    await syncMemoryFromProcessedSignalInner(signalId);
  } catch {
    /* Non-fatal: signal pipeline must still complete if memory graph write fails. */
  }
}

async function syncMemoryFromProcessedSignalInner(signalId: string): Promise<void> {
  const dup = await prisma.memoryEvidenceLink.findFirst({
    where: { signalId },
    select: { id: true },
  });
  if (dup) return;

  const envelope = await prisma.signalEnvelope.findUnique({
    where: { id: signalId },
    include: { normalizedRecord: true, extractedFacts: true },
  });
  if (!envelope?.normalizedRecord) return;

  const nodeType = signalTypeToMemoryNodeType(envelope.signalType);
  const rule = await getDecayRuleForNodeType(nodeType);
  const decay = rule?.decayRate ?? 0.01;

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(envelope.rawPayloadJson) as Record<string, unknown>;
  } catch {
    /* ignore */
  }

  const ref =
    typeof parsed.noteId === 'string'
      ? { type: 'Note', id: parsed.noteId }
      : typeof parsed.eventId === 'string'
        ? { type: 'Event', id: parsed.eventId }
        : typeof parsed.taskId === 'string'
          ? { type: 'Task', id: parsed.taskId }
          : typeof parsed.personId === 'string'
            ? { type: 'Person', id: parsed.personId }
            : typeof parsed.obligationId === 'string'
              ? { type: 'Obligation', id: parsed.obligationId }
              : typeof parsed.sourceRecordId === 'string'
                ? { type: 'SourceRecord', id: parsed.sourceRecordId }
                : null;

  const facts = envelope.extractedFacts;
  const avgConf = facts.length
    ? facts.reduce((s, f) => s + f.confidence, 0) / facts.length
    : 0.5;

  const rawSummary = envelope.normalizedRecord.normalizedText.trim();
  const summary =
    rawSummary.length > 0 ? rawSummary.slice(0, 2000) : `Signal ${envelope.signalType} (${signalId.slice(0, 8)}…)`;

  const node = await prisma.memoryNode.create({
    data: {
      userId: envelope.userId,
      nodeType,
      summary,
      confidence: avgConf,
      strengthScore: Math.min(1, 0.35 + avgConf * 0.55),
      layerType: 'evidence',
      sensitivityClass: envelope.privacyClass ?? 'medium',
      decayRate: decay,
      refEntityType: ref?.type,
      refEntityId: ref?.id,
      lastAccessedAt: new Date(),
    },
  });

  const links: {
    memoryNodeId: string;
    signalId: string;
    extractedFactId?: string;
    excerpt: string | null;
  }[] = [{ memoryNodeId: node.id, signalId: envelope.id, excerpt: summary.slice(0, 500) }];

  for (const f of facts) {
    links.push({
      memoryNodeId: node.id,
      signalId: envelope.id,
      extractedFactId: f.id,
      excerpt: f.evidenceExcerpt ?? null,
    });
  }

  await prisma.memoryEvidenceLink.createMany({ data: links });
}
