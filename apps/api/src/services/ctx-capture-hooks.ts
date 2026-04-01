import { prisma } from '@life-os/database';
import { extractPersonCandidatesFromText, extractPrimaryNameFromEventTitle } from './person-candidate-extraction.js';
import { persistEventPrepBundle } from './context-bundle-service.js';
import { findPersonByNameOrAlias, createPersonWithAlias } from './person-resolution-service.js';

/** Link person from event title + persist prep bundle (Sprint 06). */
export async function runCtxAfterEventCreated(userId: string, event: { id: string; title: string }): Promise<void> {
  const extracted = extractPrimaryNameFromEventTitle(event.title);
  if (extracted) {
    let person = await findPersonByNameOrAlias(userId, extracted);
    if (!person) {
      person = await createPersonWithAlias(userId, extracted, 'event_title');
    }
    const dup = await prisma.entityLink.findFirst({
      where: {
        userId,
        fromEntityType: 'Person',
        fromEntityId: person.id,
        toEntityType: 'Event',
        toEntityId: event.id,
        relationType: 'participant',
      },
    });
    if (!dup) {
      await prisma.entityLink.create({
        data: {
          userId,
          fromEntityType: 'Person',
          fromEntityId: person.id,
          toEntityType: 'Event',
          toEntityId: event.id,
          relationType: 'participant',
          reasonSummary: `Matched phrase from event title: "${extracted.slice(0, 120)}"`,
          confidence: 0.78,
        },
      });
    }
  }
  try {
    await persistEventPrepBundle(userId, event.id);
  } catch {
    /* non-fatal */
  }
}

/** Link note to existing persons when capitalized tokens match aliases/names (conservative). */
export async function runCtxAfterNoteCreated(
  userId: string,
  note: { id: string; title: string | null; body: string },
): Promise<void> {
  const text = `${note.title ?? ''}\n${note.body}`;
  const candidates = extractPersonCandidatesFromText(text, 14);
  const linked = new Set<string>();
  for (const c of candidates) {
    const person = await findPersonByNameOrAlias(userId, c);
    if (!person) continue;
    if (linked.has(person.id)) continue;
    linked.add(person.id);
    const dup = await prisma.entityLink.findFirst({
      where: {
        userId,
        fromEntityType: 'Person',
        fromEntityId: person.id,
        toEntityType: 'Note',
        toEntityId: note.id,
        relationType: 'NOTE_MENTION',
      },
    });
    if (dup) continue;
    await prisma.entityLink.create({
      data: {
        userId,
        fromEntityType: 'Person',
        fromEntityId: person.id,
        toEntityType: 'Note',
        toEntityId: note.id,
        relationType: 'NOTE_MENTION',
        reasonSummary: `Token "${c}" matched an existing person (alias or display name).`,
        confidence: 0.58,
      },
    });
  }
}

/** Link document text tokens to existing persons (conservative; no auto-create). */
export async function runCtxAfterDocumentCreated(
  userId: string,
  document: { id: string },
  fullText: string,
): Promise<void> {
  const candidates = extractPersonCandidatesFromText(fullText, 16);
  const linked = new Set<string>();
  for (const c of candidates) {
    const person = await findPersonByNameOrAlias(userId, c);
    if (!person) continue;
    if (linked.has(person.id)) continue;
    linked.add(person.id);
    const dup = await prisma.entityLink.findFirst({
      where: {
        userId,
        fromEntityType: 'Person',
        fromEntityId: person.id,
        toEntityType: 'Document',
        toEntityId: document.id,
        relationType: 'DOCUMENT_REFERENCE',
      },
    });
    if (dup) continue;
    await prisma.entityLink.create({
      data: {
        userId,
        fromEntityType: 'Person',
        fromEntityId: person.id,
        toEntityType: 'Document',
        toEntityId: document.id,
        relationType: 'DOCUMENT_REFERENCE',
        reasonSummary: `Token "${c}" matched an existing person from document text.`,
        confidence: 0.52,
      },
    });
  }
}
