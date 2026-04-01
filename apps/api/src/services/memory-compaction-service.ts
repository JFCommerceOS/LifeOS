import { prisma } from '@life-os/database';

/**
 * Merge duplicate memory nodes pointing at the same canonical entity (same user).
 * Keeps the stronger node; soft-compacts summary on the survivor.
 */
export async function compactRedundantEntityNodes(userId: string): Promise<{ merged: number }> {
  const nodes = await prisma.memoryNode.findMany({
    where: { userId, refEntityType: { not: null }, refEntityId: { not: null }, archivedAt: null },
    orderBy: { updatedAt: 'desc' },
  });

  const groups = new Map<string, typeof nodes>();
  for (const n of nodes) {
    if (!n.refEntityType || !n.refEntityId) continue;
    const key = `${n.refEntityType}:${n.refEntityId}:${n.nodeType}`;
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }

  let merged = 0;
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => b.strengthScore - a.strengthScore);
    const [keep, ...rest] = list;
    for (const drop of rest) {
      await prisma.memoryNode.delete({ where: { id: drop.id } });
      merged += 1;
    }
    await prisma.memoryNode.update({
      where: { id: keep.id },
      data: {
        summary: keep.summary.length >= 400 ? keep.summary : `${keep.summary} (compacted)`,
        strengthScore: Math.min(1, keep.strengthScore + 0.02),
      },
    });
  }

  return { merged };
}
