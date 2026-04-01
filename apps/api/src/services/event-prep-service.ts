import { prisma } from '@life-os/database';
import { assembleEventContext } from './context-construction-service.js';
import { persistEventPrepBundle } from './context-bundle-service.js';
import { scoreEventPrepRelevance } from './prep-relevance-scoring.js';

export async function getEventPrepPayload(userId: string, eventId: string) {
  const ctx = await assembleEventContext(userId, eventId);
  if (!ctx) return null;
  const confidence = scoreEventPrepRelevance(ctx);
  const bundle = await prisma.contextBundle.findFirst({
    where: {
      userId,
      targetEntityType: 'Event',
      targetEntityId: eventId,
      bundleType: 'EVENT_PREP',
    },
    orderBy: { generatedAt: 'desc' },
    include: { items: { orderBy: { priorityScore: 'desc' }, take: 40 } },
  });
  return { ctx, confidence, bundle };
}

export async function recomputeEventPrep(userId: string, eventId: string) {
  const out = await persistEventPrepBundle(userId, eventId);
  if (!out) return null;
  return {
    bundle: out.bundle,
    confidence: scoreEventPrepRelevance(out.ctx),
    prepSummary: out.ctx.prepSummary,
    participantNames: out.ctx.participants.map((p) => p.name),
    openObligationCount: out.ctx.openObligations.length,
    linkedNoteCount: out.ctx.priorNotes.length,
    linkedDocumentCount: out.ctx.relatedDocuments.length,
    whySurfaced:
      out.ctx.openObligations.length > 0
        ? 'Open follow-ups tied to this event or linked people.'
        : out.ctx.priorNotes.length > 0
          ? 'Linked notes surfaced for review before this event.'
          : 'Upcoming event — add participants or links for richer prep.',
  };
}
