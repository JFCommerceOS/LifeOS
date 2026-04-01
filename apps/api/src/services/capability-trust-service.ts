import { prisma } from '@life-os/database';
import { ensureUserCapabilities } from './capability-registry-service.js';

/** Deterministic trust score from feedback metrics (explainable; no ML). */
export function computeTrustFromMetrics(m: {
  confirmsCount: number;
  dismissalsCount: number;
  falsePositiveCount: number;
  correctionsCount: number;
}): number {
  let t = 0.22;
  t += 0.04 * Math.min(m.confirmsCount, 25);
  t -= 0.02 * Math.min(m.dismissalsCount, 40);
  t -= 0.07 * Math.min(m.falsePositiveCount, 15);
  t += 0.03 * Math.min(m.correctionsCount, 20);
  return Math.max(0, Math.min(1, t));
}

export async function recomputeTrustScore(userId: string, capabilityKey: string) {
  await ensureUserCapabilities(userId);
  const metrics = await prisma.capabilityFeedbackMetrics.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  if (!metrics) return null;
  const trustScore = computeTrustFromMetrics(metrics);
  const registry = await prisma.userCapabilityRegistry.update({
    where: { userId_capabilityKey: { userId, capabilityKey } },
    data: { trustScore },
  });
  return { registry, metrics, trustScore };
}

export async function getTrustSummary(userId: string, capabilityKey: string) {
  await ensureUserCapabilities(userId);
  const row = await prisma.userCapabilityRegistry.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  const metrics = await prisma.capabilityFeedbackMetrics.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  if (!row || !metrics) return null;
  const policy = await prisma.capabilityBehaviorPolicy.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  return {
    trustScore: row.trustScore,
    trustThreshold: policy?.trustThreshold ?? 0.4,
    meetsTrustThreshold: row.trustScore >= (policy?.trustThreshold ?? 0.4),
    metrics,
  };
}
