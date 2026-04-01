import type { Prisma } from '@life-os/database';
import { prisma } from '@life-os/database';

/** Entity type strings used with EntityLink (Phase 2+). */
export const ENTITY_TYPES = [
  'Person',
  'Event',
  'Note',
  'Obligation',
  'Conversation',
  'Document',
] as const;
export type EntityTypeName = (typeof ENTITY_TYPES)[number];

export function isEntityTypeName(s: string): s is EntityTypeName {
  return (ENTITY_TYPES as readonly string[]).includes(s);
}

/** All EntityLink rows touching a person (either direction). */
export async function linksTouchingPerson(userId: string, personId: string) {
  return prisma.entityLink.findMany({
    where: {
      userId,
      OR: [
        { fromEntityType: 'Person', fromEntityId: personId },
        { toEntityType: 'Person', toEntityId: personId },
      ],
    },
  });
}

export function obligationIdsFromLinks(links: { fromEntityType: string; fromEntityId: string; toEntityType: string; toEntityId: string }[]): string[] {
  const ids: string[] = [];
  for (const l of links) {
    if (l.fromEntityType === 'Obligation') ids.push(l.fromEntityId);
    if (l.toEntityType === 'Obligation') ids.push(l.toEntityId);
  }
  return [...new Set(ids)];
}

export function noteIdsFromLinks(links: { fromEntityType: string; fromEntityId: string; toEntityType: string; toEntityId: string }[]): string[] {
  const ids: string[] = [];
  for (const l of links) {
    if (l.fromEntityType === 'Note') ids.push(l.fromEntityId);
    if (l.toEntityType === 'Note') ids.push(l.toEntityId);
  }
  return [...new Set(ids)];
}

export function personIdsFromEventLinks(
  links: { fromEntityType: string; fromEntityId: string; toEntityType: string; toEntityId: string }[],
  eventId: string,
): string[] {
  const ids = new Set<string>();
  for (const l of links) {
    if (l.toEntityType === 'Event' && l.toEntityId === eventId && l.fromEntityType === 'Person') {
      ids.add(l.fromEntityId);
    }
    if (l.fromEntityType === 'Event' && l.fromEntityId === eventId && l.toEntityType === 'Person') {
      ids.add(l.toEntityId);
    }
  }
  return [...ids];
}

export function noteIdsFromEventLinks(
  links: { fromEntityType: string; fromEntityId: string; toEntityType: string; toEntityId: string }[],
  eventId: string,
): string[] {
  const ids = new Set<string>();
  for (const l of links) {
    if (l.toEntityType === 'Event' && l.toEntityId === eventId && l.fromEntityType === 'Note') {
      ids.add(l.fromEntityId);
    }
    if (l.fromEntityType === 'Event' && l.fromEntityId === eventId && l.toEntityType === 'Note') {
      ids.add(l.toEntityId);
    }
  }
  return [...ids];
}

export function documentIdsFromEventLinks(
  links: { fromEntityType: string; fromEntityId: string; toEntityType: string; toEntityId: string }[],
  eventId: string,
): string[] {
  const ids = new Set<string>();
  for (const l of links) {
    if (l.toEntityType === 'Event' && l.toEntityId === eventId && l.fromEntityType === 'Document') {
      ids.add(l.fromEntityId);
    }
    if (l.fromEntityType === 'Event' && l.fromEntityId === eventId && l.toEntityType === 'Document') {
      ids.add(l.toEntityId);
    }
  }
  return [...ids];
}

/** OR conditions for event brief: event ties + obligation–person ties for participants. */
export function eventBriefLinkOr(eventId: string, participantIds: string[]): Prisma.EntityLinkWhereInput[] {
  const or: Prisma.EntityLinkWhereInput[] = [
    { toEntityType: 'Event', toEntityId: eventId, fromEntityType: 'Person' },
    { fromEntityType: 'Event', fromEntityId: eventId, toEntityType: 'Person' },
    { toEntityType: 'Event', toEntityId: eventId, fromEntityType: 'Note' },
    { fromEntityType: 'Event', fromEntityId: eventId, toEntityType: 'Note' },
    { toEntityType: 'Event', toEntityId: eventId, fromEntityType: 'Obligation' },
    { fromEntityType: 'Event', fromEntityId: eventId, toEntityType: 'Obligation' },
    { toEntityType: 'Event', toEntityId: eventId, fromEntityType: 'Document' },
    { fromEntityType: 'Event', fromEntityId: eventId, toEntityType: 'Document' },
  ];
  for (const pid of participantIds) {
    or.push(
      { fromEntityType: 'Person', fromEntityId: pid, toEntityType: 'Obligation' },
      { toEntityType: 'Person', toEntityId: pid, fromEntityType: 'Obligation' },
    );
  }
  return or;
}

export async function loadLinksForEventBrief(userId: string, eventId: string) {
  const peLinks = await prisma.entityLink.findMany({
    where: {
      userId,
      OR: [
        { toEntityType: 'Event', toEntityId: eventId, fromEntityType: 'Person' },
        { fromEntityType: 'Event', fromEntityId: eventId, toEntityType: 'Person' },
      ],
    },
  });
  const participantIds = personIdsFromEventLinks(peLinks, eventId);
  const allLinks = await prisma.entityLink.findMany({
    where: {
      userId,
      OR: eventBriefLinkOr(eventId, participantIds),
    },
  });
  return { participantIds, allLinks };
}
