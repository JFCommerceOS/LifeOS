import type { ContextBundleType } from '@prisma/client';
import { prisma } from '@life-os/database';
import { linksTouchingPerson, noteIdsFromLinks, obligationIdsFromLinks } from '../lib/entity-graph.js';
import { assembleEventContext, upsertContextObject } from './context-construction-service.js';
import { scoreEventPrepRelevance } from './prep-relevance-scoring.js';

/** Persist EVENT_PREP bundle + items; replaces prior bundle for same target. */
export async function persistEventPrepBundle(userId: string, eventId: string) {
  const ctx = await assembleEventContext(userId, eventId);
  if (!ctx) return null;

  const confidence = scoreEventPrepRelevance(ctx);

  await prisma.contextBundle.deleteMany({
    where: {
      userId,
      targetEntityType: 'Event',
      targetEntityId: eventId,
      bundleType: 'EVENT_PREP',
    },
  });

  const bundle = await prisma.contextBundle.create({
    data: {
      userId,
      targetEntityType: 'Event',
      targetEntityId: eventId,
      bundleType: 'EVENT_PREP' as ContextBundleType,
      summaryText: ctx.prepSummary,
      confidence,
      generatedAt: new Date(),
    },
  });

  const itemRows: {
    linkedEntityType: string;
    linkedEntityId: string;
    itemRole: 'PERSON' | 'NOTE' | 'DOCUMENT' | 'OBLIGATION' | 'EVENT';
    priorityScore: number;
    reasonSummary: string;
  }[] = [];

  for (const p of ctx.participants) {
    itemRows.push({
      linkedEntityType: 'Person',
      linkedEntityId: p.id,
      itemRole: 'PERSON',
      priorityScore: 0.85,
      reasonSummary: 'Linked participant for this event.',
    });
  }
  for (const n of ctx.priorNotes) {
    itemRows.push({
      linkedEntityType: 'Note',
      linkedEntityId: n.id,
      itemRole: 'NOTE',
      priorityScore: 0.72,
      reasonSummary: 'Note linked to this event or participants.',
    });
  }
  for (const d of ctx.relatedDocuments) {
    itemRows.push({
      linkedEntityType: 'Document',
      linkedEntityId: d.id,
      itemRole: 'DOCUMENT',
      priorityScore: 0.68,
      reasonSummary: 'Document linked to this event.',
    });
  }
  for (const o of ctx.openObligations) {
    itemRows.push({
      linkedEntityType: 'Obligation',
      linkedEntityId: o.id,
      itemRole: 'OBLIGATION',
      priorityScore: o.dueAt ? 0.88 : 0.65,
      reasonSummary: o.reasonSummary?.trim() || 'Open obligation tied to prep context.',
    });
  }

  if (ctx.event.startsAt) {
    itemRows.push({
      linkedEntityType: 'Event',
      linkedEntityId: ctx.event.id,
      itemRole: 'EVENT',
      priorityScore: 0.9,
      reasonSummary: 'Event start time anchors prep.',
    });
  }

  for (const row of itemRows) {
    await prisma.contextBundleItem.create({
      data: {
        contextBundleId: bundle.id,
        linkedEntityType: row.linkedEntityType,
        linkedEntityId: row.linkedEntityId,
        itemRole: row.itemRole,
        priorityScore: row.priorityScore,
        reasonSummary: row.reasonSummary.slice(0, 500),
      },
    });
  }

  await upsertContextObject(
    userId,
    'EVENT_CONTEXT',
    'Event',
    eventId,
    {
      prepSummary: ctx.prepSummary,
      bundleId: bundle.id,
      confidence,
      participantCount: ctx.participants.length,
      openObligationCount: ctx.openObligations.length,
      linkedNoteCount: ctx.priorNotes.length,
      linkedDocumentCount: ctx.relatedDocuments.length,
    },
    confidence,
  );

  return { bundle, ctx };
}

/** Persist PERSON_CONTEXT summary for person detail / memory. */
export async function persistPersonContextBundle(userId: string, personId: string) {
  const person = await prisma.person.findFirst({ where: { id: personId, userId } });
  if (!person) return null;

  const links = await linksTouchingPerson(userId, personId);
  const noteIds = noteIdsFromLinks(links);
  const obIds = obligationIdsFromLinks(links);

  const [notes, obs] = await Promise.all([
    noteIds.length
      ? prisma.note.findMany({
          where: { userId, id: { in: noteIds } },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        })
      : [],
    obIds.length
      ? prisma.obligation.findMany({
          where: { userId, id: { in: obIds }, status: 'open' },
          orderBy: { dueAt: 'asc' },
          take: 10,
        })
      : [],
  ]);

  const summaryText = [
    obs.length ? `${obs.length} open obligation(s) in your graph involving ${person.name}.` : null,
    notes.length ? `${notes.length} linked note(s).` : null,
  ]
    .filter(Boolean)
    .join(' ') || `Context for ${person.name} — add links from notes or events.`;

  const confidence = Math.min(0.9, 0.45 + (notes.length ? 0.15 : 0) + (obs.length ? 0.2 : 0));

  await prisma.contextBundle.deleteMany({
    where: {
      userId,
      targetEntityType: 'Person',
      targetEntityId: personId,
      bundleType: 'PERSON_CONTEXT',
    },
  });

  const bundle = await prisma.contextBundle.create({
    data: {
      userId,
      targetEntityType: 'Person',
      targetEntityId: personId,
      bundleType: 'PERSON_CONTEXT',
      summaryText,
      confidence,
      generatedAt: new Date(),
    },
  });

  for (const n of notes) {
    await prisma.contextBundleItem.create({
      data: {
        contextBundleId: bundle.id,
        linkedEntityType: 'Note',
        linkedEntityId: n.id,
        itemRole: 'NOTE',
        priorityScore: 0.7,
        reasonSummary: 'Linked via entity graph.',
      },
    });
  }
  for (const o of obs) {
    await prisma.contextBundleItem.create({
      data: {
        contextBundleId: bundle.id,
        linkedEntityType: 'Obligation',
        linkedEntityId: o.id,
        itemRole: 'OBLIGATION',
        priorityScore: 0.82,
        reasonSummary: o.reasonSummary?.slice(0, 400) || 'Open obligation linked to this person.',
      },
    });
  }

  await upsertContextObject(
    userId,
    'PERSON_CONTEXT',
    'Person',
    personId,
    { bundleId: bundle.id, summaryText, noteCount: notes.length, obligationCount: obs.length },
    confidence,
  );

  return { bundle, person, notes, obligations: obs };
}
