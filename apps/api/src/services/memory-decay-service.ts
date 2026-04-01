import type { MemoryNodeType } from '@prisma/client';
import { prisma } from '@life-os/database';

const DEFAULT_RULES: { nodeType: MemoryNodeType; decayRate: number; inactivityThresholdDays: number; archiveThresholdDays: number }[] = [
  { nodeType: 'PERSON', decayRate: 0.008, inactivityThresholdDays: 45, archiveThresholdDays: 400 },
  { nodeType: 'EVENT', decayRate: 0.02, inactivityThresholdDays: 14, archiveThresholdDays: 180 },
  { nodeType: 'OBLIGATION', decayRate: 0.006, inactivityThresholdDays: 30, archiveThresholdDays: 365 },
  { nodeType: 'TASK', decayRate: 0.01, inactivityThresholdDays: 21, archiveThresholdDays: 365 },
  { nodeType: 'NOTE', decayRate: 0.012, inactivityThresholdDays: 30, archiveThresholdDays: 365 },
  { nodeType: 'DOCUMENT', decayRate: 0.009, inactivityThresholdDays: 60, archiveThresholdDays: 730 },
  { nodeType: 'PROJECT', decayRate: 0.007, inactivityThresholdDays: 45, archiveThresholdDays: 730 },
  { nodeType: 'ROUTINE', decayRate: 0.005, inactivityThresholdDays: 60, archiveThresholdDays: 730 },
  { nodeType: 'PLACE', decayRate: 0.015, inactivityThresholdDays: 30, archiveThresholdDays: 365 },
  { nodeType: 'DECISION', decayRate: 0.006, inactivityThresholdDays: 90, archiveThresholdDays: 730 },
  { nodeType: 'PREFERENCE', decayRate: 0.004, inactivityThresholdDays: 120, archiveThresholdDays: 730 },
];

/** Idempotent defaults for blueprint `memory_decay_rules`. */
export async function ensureDefaultDecayRules(): Promise<void> {
  for (const r of DEFAULT_RULES) {
    await prisma.memoryDecayRule.upsert({
      where: { nodeType: r.nodeType },
      create: {
        nodeType: r.nodeType,
        decayRate: r.decayRate,
        inactivityThresholdDays: r.inactivityThresholdDays,
        archiveThresholdDays: r.archiveThresholdDays,
      },
      update: {},
    });
  }
}

export async function getDecayRuleForNodeType(nodeType: MemoryNodeType) {
  await ensureDefaultDecayRules();
  return prisma.memoryDecayRule.findUnique({ where: { nodeType } });
}

/**
 * Heuristic decay: strength drops when access is stale; very weak nodes move to cold + archive record.
 */
export async function applyDecayForUser(userId: string): Promise<{ updated: number; archived: number }> {
  await ensureDefaultDecayRules();
  const nodes = await prisma.memoryNode.findMany({
    where: { userId, archivedAt: null },
  });
  const now = Date.now();
  let updated = 0;
  let archived = 0;

  for (const n of nodes) {
    const rule = await prisma.memoryDecayRule.findUnique({ where: { nodeType: n.nodeType } });
    const decayRate = rule?.decayRate ?? n.decayRate;
    const daysSinceAccess = n.lastAccessedAt
      ? (now - n.lastAccessedAt.getTime()) / 86_400_000
      : (now - n.updatedAt.getTime()) / 86_400_000;

    const delta = decayRate * Math.min(daysSinceAccess, 365) * 0.02;
    let nextStrength = Math.max(0.05, n.strengthScore - delta);

    const archiveDays = rule?.archiveThresholdDays ?? 365;
    if (daysSinceAccess > archiveDays && nextStrength < 0.2) {
      await prisma.$transaction([
        prisma.memoryNode.update({
          where: { id: n.id },
          data: {
            strengthScore: nextStrength,
            layerType: 'cold_archive',
            archivedAt: new Date(),
          },
        }),
        prisma.memoryArchiveRecord.create({
          data: { memoryNodeId: n.id, reason: 'decay_inactivity' },
        }),
      ]);
      archived += 1;
      updated += 1;
      continue;
    }

    if (Math.abs(nextStrength - n.strengthScore) > 0.001) {
      await prisma.memoryNode.update({
        where: { id: n.id },
        data: { strengthScore: nextStrength },
      });
      updated += 1;
    }
  }

  return { updated, archived };
}
