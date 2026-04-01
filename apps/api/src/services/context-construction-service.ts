import type { ContextObjectType } from '@prisma/client';
import { prisma } from '@life-os/database';
import {
  documentIdsFromEventLinks,
  linksTouchingPerson,
  loadLinksForEventBrief,
  noteIdsFromEventLinks,
  obligationIdsFromLinks,
  noteIdsFromLinks,
} from '../lib/entity-graph.js';

/** Event prep bundle (Daily Brief / event detail). */
export async function assembleEventContext(userId: string, eventId: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, userId } });
  if (!event) return null;

  const { participantIds, allLinks } = await loadLinksForEventBrief(userId, eventId);
  const persons = participantIds.length
    ? await prisma.person.findMany({ where: { userId, id: { in: participantIds } } })
    : [];

  const noteIds = noteIdsFromEventLinks(allLinks, eventId);
  const docIds = documentIdsFromEventLinks(allLinks, eventId);
  const obIds = obligationIdsFromLinks(allLinks);

  const [priorNotes, relatedDocuments, openObligations, lastDiscussed] = await Promise.all([
    noteIds.length
      ? prisma.note.findMany({
          where: { userId, id: { in: noteIds } },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        })
      : [],
    docIds.length
      ? prisma.document.findMany({
          where: { userId, id: { in: docIds } },
          orderBy: { updatedAt: 'desc' },
          take: 15,
          select: {
            id: true,
            title: true,
            documentFamily: true,
            documentSubtype: true,
            processingStatus: true,
            summaryLine: true,
            updatedAt: true,
          },
        })
      : [],
    obIds.length
      ? prisma.obligation.findMany({
          where: { userId, id: { in: obIds }, status: 'open' },
          orderBy: { dueAt: 'asc' },
        })
      : [],
    participantIds.length
      ? prisma.conversation.findFirst({
          where: {
            userId,
            personId: { in: participantIds },
            ...(event.startsAt ? { occurredAt: { lt: event.startsAt } } : {}),
          },
          orderBy: { occurredAt: 'desc' },
          include: { person: true },
        })
      : null,
  ]);

  const prepParts: string[] = [];
  if (openObligations.length)
    prepParts.push(`${openObligations.length} open obligation(s) tied to this meeting or participants.`);
  if (priorNotes.length) prepParts.push(`${priorNotes.length} linked note(s).`);
  if (relatedDocuments.length)
    prepParts.push(`${relatedDocuments.length} linked document(s) for review.`);
  if (persons.length) prepParts.push(`Participants: ${persons.map((p) => p.name).join(', ')}.`);
  if (lastDiscussed) {
    prepParts.push(
      `Last discussed: ${lastDiscussed.title ?? lastDiscussed.summary ?? '(no title)'}.`,
    );
  }
  const prepSummary =
    prepParts.length > 0 ? prepParts.join(' ') : 'Link people and notes to this event to see prep context.';

  return {
    event,
    participants: persons,
    priorNotes,
    relatedDocuments,
    openObligations,
    lastDiscussed,
    prepSummary,
  };
}

export async function assemblePersonCard(userId: string, personId: string) {
  const person = await prisma.person.findFirst({ where: { id: personId, userId } });
  if (!person) return null;

  const links = await linksTouchingPerson(userId, personId);
  const obIds = obligationIdsFromLinks(links);
  const noteIds = noteIdsFromLinks(links);

  const [openObligations, linkedNotes, conversations] = await Promise.all([
    obIds.length
      ? prisma.obligation.findMany({
          where: { userId, id: { in: obIds }, status: 'open' },
          orderBy: { dueAt: 'asc' },
        })
      : [],
    noteIds.length
      ? prisma.note.findMany({
          where: { userId, id: { in: noteIds } },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        })
      : [],
    prisma.conversation.findMany({
      where: { userId, personId },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    }),
  ]);

  return { person, openObligations, linkedNotes, conversations };
}

export async function assembleObligationContext(userId: string, obligationId: string) {
  const obligation = await prisma.obligation.findFirst({ where: { id: obligationId, userId } });
  if (!obligation) return null;

  const links = await prisma.entityLink.findMany({
    where: {
      userId,
      OR: [
        { fromEntityType: 'Obligation', fromEntityId: obligationId },
        { toEntityType: 'Obligation', toEntityId: obligationId },
      ],
    },
  });

  const noteIds = noteIdsFromLinks(links);
  const eventIds: string[] = [];
  for (const l of links) {
    if (l.fromEntityType === 'Event') eventIds.push(l.fromEntityId);
    if (l.toEntityType === 'Event') eventIds.push(l.toEntityId);
  }
  const uniqueEvents = [...new Set(eventIds)];

  const [linkedNotes, linkedEvents] = await Promise.all([
    noteIds.length
      ? prisma.note.findMany({ where: { userId, id: { in: noteIds } }, orderBy: { updatedAt: 'desc' }, take: 10 })
      : [],
    uniqueEvents.length
      ? prisma.event.findMany({ where: { userId, id: { in: uniqueEvents } }, orderBy: { startsAt: 'asc' }, take: 10 })
      : [],
  ]);

  const summary = {
    title: obligation.title,
    status: obligation.status,
    dueAt: obligation.dueAt,
    linkedNoteCount: linkedNotes.length,
    linkedEventCount: linkedEvents.length,
  };

  return { obligation, links, linkedNotes, linkedEvents, summary };
}

export async function assembleCurrentContext(userId: string) {
  const [userState, recentContextObjects, latestSignals] = await Promise.all([
    prisma.userStateSnapshot.findFirst({
      where: { userId },
      orderBy: { detectedAt: 'desc' },
    }),
    prisma.contextObject.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.signalEnvelope.findMany({
      where: { userId },
      orderBy: { receivedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        signalType: true,
        processingStatus: true,
        receivedAt: true,
      },
    }),
  ]);

  return {
    userState,
    recentContextObjects,
    recentSignals: latestSignals,
  };
}

export async function upsertContextObject(
  userId: string,
  contextType: ContextObjectType,
  linkedEntityType: string,
  linkedEntityId: string,
  summary: Record<string, unknown>,
  confidence = 0.75,
): Promise<void> {
  const summaryJson = JSON.stringify(summary);
  const existing = await prisma.contextObject.findFirst({
    where: { userId, contextType, linkedEntityType, linkedEntityId },
  });
  if (existing) {
    await prisma.contextObject.update({
      where: { id: existing.id },
      data: { summaryJson, confidence, freshnessScore: 1, updatedAt: new Date() },
    });
  } else {
    await prisma.contextObject.create({
      data: {
        userId,
        contextType,
        linkedEntityType,
        linkedEntityId,
        summaryJson,
        confidence,
        freshnessScore: 1,
      },
    });
  }
}
