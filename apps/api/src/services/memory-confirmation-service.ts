import { prisma } from '@life-os/database';

export async function recordMemoryConfirmation(args: {
  userId: string;
  memoryNodeId: string;
  confirmedByUser: boolean;
  corrected?: boolean;
  correctionNote?: string | null;
}) {
  const node = await prisma.memoryNode.findFirst({
    where: { id: args.memoryNodeId, userId: args.userId },
  });
  if (!node) throw new Error('Memory node not found');

  const confirmation = await prisma.memoryConfirmation.create({
    data: {
      memoryNodeId: args.memoryNodeId,
      confirmedByUser: args.confirmedByUser,
      corrected: args.corrected ?? false,
      correctionNote: args.correctionNote ?? undefined,
    },
  });

  await prisma.memoryNode.update({
    where: { id: args.memoryNodeId },
    data: {
      lastConfirmedAt: new Date(),
      confidence: Math.min(1, node.confidence + (args.confirmedByUser ? 0.08 : 0)),
      strengthScore: Math.min(1, node.strengthScore + (args.confirmedByUser ? 0.06 : 0)),
      lastAccessedAt: new Date(),
    },
  });

  return confirmation;
}

export async function applyMemoryCorrection(args: {
  userId: string;
  memoryNodeId: string;
  newSummary?: string;
  correctionNote: string;
  /** Sprint 04 — user-specified confidence after correction */
  correctedConfidence?: number;
}) {
  const node = await prisma.memoryNode.findFirst({
    where: { id: args.memoryNodeId, userId: args.userId },
  });
  if (!node) throw new Error('Memory node not found');

  await prisma.memoryConfirmation.create({
    data: {
      memoryNodeId: args.memoryNodeId,
      confirmedByUser: true,
      corrected: true,
      correctionNote: args.correctionNote,
    },
  });

  const nextConfidence =
    args.correctedConfidence !== undefined
      ? Math.min(1, Math.max(0, args.correctedConfidence))
      : Math.min(1, node.confidence + 0.05);

  await prisma.memoryNode.update({
    where: { id: args.memoryNodeId },
    data: {
      summary: args.newSummary ?? node.summary,
      lastConfirmedAt: new Date(),
      lastAccessedAt: new Date(),
      confidence: nextConfidence,
    },
  });
}
