import type { DataSensitivityLevel, RetentionClass } from '@prisma/client';
import { prisma } from '@life-os/database';

const DEFAULTS: { category: string; sensitivityLevel: DataSensitivityLevel; retentionClass: RetentionClass }[] = [
  { category: 'notes', sensitivityLevel: 'NORMAL', retentionClass: 'WARM_CONTINUITY' },
  { category: 'events', sensitivityLevel: 'NORMAL', retentionClass: 'WARM_CONTINUITY' },
  { category: 'tasks', sensitivityLevel: 'NORMAL', retentionClass: 'WARM_CONTINUITY' },
  { category: 'documents', sensitivityLevel: 'SENSITIVE', retentionClass: 'EVIDENCE_SHORT_LIFE' },
  { category: 'admin_records', sensitivityLevel: 'SENSITIVE', retentionClass: 'WARM_CONTINUITY' },
  { category: 'source_records', sensitivityLevel: 'ELEVATED', retentionClass: 'EVIDENCE_SHORT_LIFE' },
  { category: 'memory_nodes', sensitivityLevel: 'ELEVATED', retentionClass: 'SEMANTIC_LONG_LIFE' },
];

export async function ensureDefaultRetentionPolicies(userId: string) {
  for (const d of DEFAULTS) {
    await prisma.dataRetentionPolicy.upsert({
      where: { userId_category: { userId, category: d.category } },
      create: {
        userId,
        category: d.category,
        sensitivityLevel: d.sensitivityLevel,
        retentionClass: d.retentionClass,
      },
      update: {},
    });
  }
}

export async function listRetentionPolicies(userId: string) {
  await ensureDefaultRetentionPolicies(userId);
  return prisma.dataRetentionPolicy.findMany({ where: { userId }, orderBy: { category: 'asc' } });
}
