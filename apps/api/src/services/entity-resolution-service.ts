import { prisma } from '@life-os/database';
import type { FactDraft } from './fact-extraction-service.js';

/**
 * Soft resolution: enrich PERSON_MENTION facts with candidate person ids (no hard merges).
 */
export async function resolvePersonMentionsOnDrafts(
  userId: string,
  drafts: FactDraft[],
): Promise<FactDraft[]> {
  const persons = await prisma.person.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const byLower = new Map(persons.map((p) => [p.name.toLowerCase(), p.id]));

  return drafts.map((fact) => {
    if (fact.factType !== 'PERSON_MENTION') return fact;
    try {
      const v = JSON.parse(fact.factValueJson) as { name?: string };
      const name = v.name?.trim();
      if (!name) return fact;
      const id = byLower.get(name.toLowerCase());
      if (!id) return fact;
      return {
        ...fact,
        factValueJson: JSON.stringify({ ...v, candidatePersonId: id, resolution: 'weak_match' }),
        confidence: Math.min(0.85, fact.confidence + 0.2),
      };
    } catch {
      return fact;
    }
  });
}
