import { prisma } from '@life-os/database';

export function hasEvidenceExcerpt(excerpt: string | null | undefined): boolean {
  return Boolean(excerpt && excerpt.trim().length > 0);
}

/** Sprint 02 — materialize EvidenceItem rows for obligations + fact lineage. */
export async function linkEvidenceToObligations(
  userId: string,
  signalId: string,
  pairs: { obligationId: string; factIds: string[] }[],
): Promise<number> {
  let n = 0;
  for (const { obligationId, factIds } of pairs) {
    for (const factId of factIds) {
      const fact = await prisma.extractedFact.findFirst({
        where: { id: factId, signalId },
      });
      if (!fact) continue;
      await prisma.evidenceItem.create({
        data: {
          userId,
          obligationId,
          sourceSignalId: signalId,
          extractedFactId: factId,
          kind: 'extracted',
          summary: (fact.evidenceExcerpt ?? fact.factType).slice(0, 2000),
        },
      });
      n += 1;
    }
  }
  return n;
}
