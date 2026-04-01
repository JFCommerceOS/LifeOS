import { prisma } from '@life-os/database';

export type SimilarDecision = {
  id: string;
  title: string;
  decidedAt: Date;
  outcomeNote: string | null;
};

/** Find prior decisions with the same topicKey (explicit user tagging). */
export async function findSimilarDecisions(
  userId: string,
  topicKey: string | null | undefined,
  excludeId?: string,
): Promise<SimilarDecision[]> {
  const key = (topicKey ?? '').trim();
  if (!key) return [];

  const rows = await prisma.decisionRecord.findMany({
    where: {
      userId,
      topicKey: key,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { decidedAt: 'desc' },
    take: 8,
    select: { id: true, title: true, decidedAt: true, outcomeNote: true },
  });

  return rows;
}
