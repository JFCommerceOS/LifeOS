import { prisma } from '@life-os/database';
import type { SignalEnvelope, SignalProcessingStage } from '@prisma/client';
import { extractFactsFromNormalized } from './fact-extraction-service.js';
import { normalizeSignalEnvelope } from './signal-normalization-service.js';
import { resolvePersonMentionsOnDrafts } from './entity-resolution-service.js';
import {
  assembleEventContext,
  assembleObligationContext,
  assemblePersonCard,
  upsertContextObject,
} from './context-construction-service.js';
import type { FactDraft } from './fact-extraction-service.js';
import { syncMemoryFromProcessedSignal } from './memory-sync-from-signal.js';
import { createObligationsFromPipeline } from './obligation-detection-service.js';
import { linkEvidenceToObligations } from './evidence-linking-service.js';

async function logStage(
  signalId: string,
  stage: SignalProcessingStage,
  status: string,
  summary?: string,
  errorCode?: string,
) {
  await prisma.signalProcessingLog.create({
    data: { signalId, stage, status, summary, errorCode },
  });
}

async function upsertContextFromPipeline(
  userId: string,
  envelope: SignalEnvelope,
  drafts: FactDraft[],
): Promise<void> {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(envelope.rawPayloadJson) as Record<string, unknown>;
  } catch {
    return;
  }

  if (typeof parsed.personId === 'string') {
    const card = await assemblePersonCard(userId, parsed.personId);
    if (card) {
      await upsertContextObject(userId, 'PERSON_CONTEXT', 'Person', parsed.personId, {
        person: { id: card.person.id, name: card.person.name },
        openObligationCount: card.openObligations.length,
        linkedNoteCount: card.linkedNotes.length,
        source: 'payload',
      });
    }
  }

  if (typeof parsed.eventId === 'string') {
    const ec = await assembleEventContext(userId, parsed.eventId);
    if (ec) {
      await upsertContextObject(userId, 'EVENT_CONTEXT', 'Event', parsed.eventId, {
        prepSummary: ec.prepSummary,
        participantCount: ec.participants.length,
        openObligationCount: ec.openObligations.length,
        source: 'payload',
      });
    }
  }

  if (typeof parsed.obligationId === 'string') {
    const o = await assembleObligationContext(userId, parsed.obligationId);
    if (o) {
      await upsertContextObject(userId, 'OBLIGATION_CONTEXT', 'Obligation', parsed.obligationId, {
        ...o.summary,
        source: 'payload',
      });
    }
  }

  for (const d of drafts) {
    if (d.factType !== 'PERSON_MENTION') continue;
    try {
      const v = JSON.parse(d.factValueJson) as { candidatePersonId?: string };
      if (!v.candidatePersonId) continue;
      const card = await assemblePersonCard(userId, v.candidatePersonId);
      if (card) {
        await upsertContextObject(userId, 'PERSON_CONTEXT', 'Person', v.candidatePersonId, {
          person: { id: card.person.id, name: card.person.name },
          source: 'entity_resolution',
        });
      }
      break;
    } catch {
      /* ignore */
    }
  }
}

export async function runSignalProcessingPipeline(signalId: string): Promise<void> {
  const envelope = await prisma.signalEnvelope.findUnique({ where: { id: signalId } });
  if (!envelope) throw new Error('Signal not found');

  const already = await prisma.normalizedSignalRecord.findUnique({ where: { signalId } });
  if (already) return;

  let failStage: SignalProcessingStage = 'normalization';

  try {
    await logStage(signalId, 'intake', 'ok', 'accepted');

    await prisma.signalEnvelope.update({
      where: { id: signalId },
      data: { processingStatus: 'normalizing' },
    });

    const norm = normalizeSignalEnvelope(envelope);
    await prisma.normalizedSignalRecord.create({
      data: {
        signalId,
        ...norm,
      },
    });
    await logStage(signalId, 'normalization', 'ok', 'normalized');

    await prisma.signalEnvelope.update({
      where: { id: signalId },
      data: { processingStatus: 'extracting' },
    });

    failStage = 'extraction';
    const refTime = envelope.occurredAt ?? envelope.receivedAt ?? new Date();
    let drafts = extractFactsFromNormalized({
      normalizedText: norm.normalizedText,
      signalType: envelope.signalType,
      referenceTime: refTime,
    });
    drafts = await resolvePersonMentionsOnDrafts(envelope.userId, drafts);

    await prisma.extractedFact.createMany({
      data: drafts.map((d) => ({
        signalId,
        factType: d.factType,
        factValueJson: d.factValueJson,
        confidence: d.confidence,
        observedVsExtracted: d.observedVsExtracted,
        evidenceExcerpt: d.evidenceExcerpt,
      })),
    });
    const factRows = await prisma.extractedFact.findMany({
      where: { signalId },
      orderBy: { createdAt: 'asc' },
    });
    const det = await createObligationsFromPipeline(envelope, norm, factRows);
    const pairs = det.obligationIds.map((oid) => ({
      obligationId: oid,
      factIds: det.factIdsByObligationId[oid] ?? [],
    }));
    const evN = await linkEvidenceToObligations(envelope.userId, signalId, pairs);
    await logStage(
      signalId,
      'extraction',
      'ok',
      `${drafts.length} facts; obligations:${det.count}; evidence_items:${evN}`,
    );

    await prisma.signalEnvelope.update({
      where: { id: signalId },
      data: { processingStatus: 'resolving' },
    });
    failStage = 'entity_resolution';
    await logStage(signalId, 'entity_resolution', 'ok', 'person mentions checked');

    failStage = 'context_construction';
    await upsertContextFromPipeline(envelope.userId, envelope, drafts);

    await prisma.signalEnvelope.update({
      where: { id: signalId },
      data: { processingStatus: 'context_ready' },
    });
    await logStage(signalId, 'context_construction', 'ok', 'context objects updated where applicable');
    await logStage(signalId, 'evidence', 'ok', 'excerpts stored on facts');

    await syncMemoryFromProcessedSignal(signalId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.signalEnvelope.update({
      where: { id: signalId },
      data: { processingStatus: 'failed' },
    });
    await logStage(signalId, failStage, 'error', message.slice(0, 500), 'PIPELINE_ERROR');
    throw e;
  }
}
