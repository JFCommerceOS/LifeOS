import type { MemoryEdgeType, MemoryNodeType } from '@prisma/client';
import { prisma } from '@life-os/database';
import { createMemoryEdge, createMemoryNode } from './memory-graph-service.js';

/** One canonical active memory node per ref entity (Sprint 03). */
export async function upsertMemoryNodeForRef(args: {
  userId: string;
  nodeType: MemoryNodeType;
  refEntityType: string;
  refEntityId: string;
  summary: string;
  confidence?: number;
  strengthDelta?: number;
}): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.memoryNode.findFirst({
    where: {
      userId: args.userId,
      refEntityType: args.refEntityType,
      refEntityId: args.refEntityId,
      archivedAt: null,
    },
  });

  if (existing) {
    const strength = Math.min(1, existing.strengthScore + (args.strengthDelta ?? 0.03));
    await prisma.memoryNode.update({
      where: { id: existing.id },
      data: {
        summary: args.summary.slice(0, 2000),
        lastObservedAt: new Date(),
        confidence: args.confidence ?? existing.confidence,
        strengthScore: strength,
        status: 'active',
      },
    });
    return { id: existing.id, created: false };
  }

  const n = await createMemoryNode({
    userId: args.userId,
    nodeType: args.nodeType,
    summary: args.summary.slice(0, 2000),
    confidence: args.confidence ?? 0.55,
    strengthScore: 0.45,
    refEntityType: args.refEntityType,
    refEntityId: args.refEntityId,
    layerType: 'warm_episodic',
  });
  await prisma.memoryNode.update({
    where: { id: n.id },
    data: { lastObservedAt: new Date(), status: 'active' },
  });
  return { id: n.id, created: true };
}

export async function ensureEdge(
  userId: string,
  fromNodeId: string,
  toNodeId: string,
  edgeType: MemoryEdgeType,
  strength = 0.55,
): Promise<void> {
  const dup = await prisma.memoryEdge.findFirst({
    where: { fromNodeId, toNodeId, edgeType },
  });
  if (dup) {
    await prisma.memoryEdge.update({
      where: { id: dup.id },
      data: { active: true, strength, updatedAt: new Date(), evidenceCount: { increment: 1 } },
    });
    return;
  }
  await createMemoryEdge({ userId, fromNodeId, toNodeId, edgeType, strength });
}

/** Link obligation memory node → suggestion memory node (continuity lineage). */
export async function linkObligationSuggestionMemory(args: {
  userId: string;
  obligationId: string;
  obligationTitle: string;
  suggestionId: string;
  suggestionTitle: string;
}): Promise<void> {
  const ob = await upsertMemoryNodeForRef({
    userId: args.userId,
    nodeType: 'OBLIGATION',
    refEntityType: 'Obligation',
    refEntityId: args.obligationId,
    summary: args.obligationTitle,
  });
  const sg = await upsertMemoryNodeForRef({
    userId: args.userId,
    nodeType: 'SUGGESTION',
    refEntityType: 'Suggestion',
    refEntityId: args.suggestionId,
    summary: args.suggestionTitle,
  });
  await ensureEdge(args.userId, ob.id, sg.id, 'caused_by', 0.62);
}
