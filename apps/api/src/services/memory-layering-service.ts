import type { MemoryLayerType } from '@prisma/client';
import { prisma } from '@life-os/database';

/** Move node between layers (e.g. evidence → warm after reinforcement). */
export async function setMemoryLayer(
  userId: string,
  nodeId: string,
  layerType: MemoryLayerType,
): Promise<void> {
  const n = await prisma.memoryNode.findFirst({ where: { id: nodeId, userId } });
  if (!n) throw new Error('Memory node not found');

  await prisma.memoryNode.update({
    where: { id: nodeId },
    data: { layerType, updatedAt: new Date() },
  });
}

/** Promote episodic → semantic when reinforced (caller supplies policy). */
export async function promoteToSemantic(userId: string, nodeId: string): Promise<void> {
  const n = await prisma.memoryNode.findFirst({ where: { id: nodeId, userId } });
  if (!n) throw new Error('Memory node not found');

  await prisma.memoryNode.update({
    where: { id: nodeId },
    data: {
      layerType: 'semantic',
      strengthScore: Math.min(1, n.strengthScore * 1.05),
      lastConfirmedAt: new Date(),
    },
  });
}
