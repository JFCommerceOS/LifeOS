import type { MemoryEdgeType, MemoryNodeType } from '@prisma/client';
import { prisma } from '@life-os/database';

export async function createMemoryNode(args: {
  userId: string;
  nodeType: MemoryNodeType;
  summary: string;
  confidence?: number;
  strengthScore?: number;
  layerType?: import('@prisma/client').MemoryLayerType;
  sensitivityClass?: string;
  refEntityType?: string | null;
  refEntityId?: string | null;
  decayRate?: number;
}) {
  return prisma.memoryNode.create({
    data: {
      userId: args.userId,
      nodeType: args.nodeType,
      summary: args.summary,
      confidence: args.confidence ?? 0.5,
      strengthScore: args.strengthScore ?? 0.5,
      layerType: args.layerType ?? 'evidence',
      sensitivityClass: args.sensitivityClass ?? 'medium',
      refEntityType: args.refEntityType ?? undefined,
      refEntityId: args.refEntityId ?? undefined,
      decayRate: args.decayRate ?? 0.01,
      lastAccessedAt: new Date(),
    },
  });
}

export async function createMemoryEdge(args: {
  userId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: MemoryEdgeType;
  strength?: number;
}) {
  const [a, b] = await Promise.all([
    prisma.memoryNode.findFirst({ where: { id: args.fromNodeId, userId: args.userId } }),
    prisma.memoryNode.findFirst({ where: { id: args.toNodeId, userId: args.userId } }),
  ]);
  if (!a || !b) throw new Error('Memory nodes not found for user');

  return prisma.memoryEdge.create({
    data: {
      fromNodeId: args.fromNodeId,
      toNodeId: args.toNodeId,
      edgeType: args.edgeType,
      strength: args.strength ?? 0.5,
    },
  });
}

export async function getMemoryNodeWithGraph(userId: string, nodeId: string) {
  const node = await prisma.memoryNode.findFirst({
    where: { id: nodeId, userId },
    include: {
      edgesOut: true,
      edgesIn: true,
      evidenceLinks: { orderBy: { createdAt: 'asc' } },
      confirmations: { orderBy: { createdAt: 'desc' } },
      archiveRecords: { orderBy: { archivedAt: 'desc' } },
    },
  });
  return node;
}
