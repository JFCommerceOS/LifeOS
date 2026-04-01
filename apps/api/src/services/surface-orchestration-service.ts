import { prisma } from '@life-os/database';
import type { AssistantSurfaceType } from '@prisma/client';

const DEFAULT_POLICIES: Array<{
  surfaceType: AssistantSurfaceType;
  privacyMode: string;
  urgencyThreshold: number;
  interruptionLimit: number;
  contentDensity: string;
}> = [
  { surfaceType: 'phone', privacyMode: 'balanced', urgencyThreshold: 0.4, interruptionLimit: 20, contentDensity: 'normal' },
  { surfaceType: 'watch', privacyMode: 'strict', urgencyThreshold: 0.65, interruptionLimit: 8, contentDensity: 'low' },
  { surfaceType: 'tile', privacyMode: 'balanced', urgencyThreshold: 0.5, interruptionLimit: 15, contentDensity: 'low' },
  { surfaceType: 'silent', privacyMode: 'strict', urgencyThreshold: 0.95, interruptionLimit: 0, contentDensity: 'low' },
  { surfaceType: 'accessory', privacyMode: 'balanced', urgencyThreshold: 0.55, interruptionLimit: 10, contentDensity: 'low' },
];

export async function ensureDefaultSurfacePolicies(userId: string): Promise<void> {
  const n = await prisma.surfaceDeliveryPolicy.count({ where: { userId } });
  if (n > 0) return;
  await prisma.$transaction(
    DEFAULT_POLICIES.map((p) => prisma.surfaceDeliveryPolicy.create({ data: { userId, ...p } })),
  );
}

export async function listSurfacePolicies(userId: string) {
  await ensureDefaultSurfacePolicies(userId);
  return prisma.surfaceDeliveryPolicy.findMany({ where: { userId }, orderBy: { surfaceType: 'asc' } });
}
