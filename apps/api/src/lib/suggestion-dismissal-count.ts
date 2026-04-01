import { prisma } from '@life-os/database';

/**
 * Counts `DismissalRule` rows keyed by `patternJson` `{ suggestionId }` from suggestion dismiss actions.
 * Used to feed `dismissCount` into assistant mediation (repetition control).
 */
export async function loadDismissalCountsBySuggestionId(userId: string): Promise<Map<string, number>> {
  const rules = await prisma.dismissalRule.findMany({
    where: { userId },
    select: { patternJson: true },
  });
  const counts = new Map<string, number>();
  for (const r of rules) {
    try {
      const j = JSON.parse(r.patternJson) as { suggestionId?: string };
      if (j.suggestionId) {
        const id = j.suggestionId;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    } catch {
      /* ignore malformed */
    }
  }
  return counts;
}
