import type { MemoryLayerType, MemoryNodeType } from '@prisma/client';
import { prisma } from '@life-os/database';

export type RetrievalOpts = {
  limit?: number;
  layerTypes?: MemoryLayerType[];
  nodeTypes?: MemoryNodeType[];
  includeArchived?: boolean;
};

/** Rank by strength × recency for assistant / context assembly. */
export async function retrieveMemoryForUser(userId: string, opts: RetrievalOpts = {}) {
  const limit = Math.min(opts.limit ?? 30, 100);
  const where = {
    userId,
    ...(opts.includeArchived ? {} : { archivedAt: null }),
    ...(opts.layerTypes?.length ? { layerType: { in: opts.layerTypes } } : {}),
    ...(opts.nodeTypes?.length ? { nodeType: { in: opts.nodeTypes } } : {}),
  };

  const rows = await prisma.memoryNode.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    take: limit * 2,
    include: {
      evidenceLinks: { take: 5, orderBy: { createdAt: 'desc' } },
    },
  });

  const ranked = rows
    .map((n) => {
      const recency = Math.exp(-(Date.now() - n.updatedAt.getTime()) / (30 * 86_400_000));
      const score = n.strengthScore * (0.5 + 0.5 * recency);
      return { node: n, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.node);

  return ranked;
}
