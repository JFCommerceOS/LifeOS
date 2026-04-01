import { prisma } from '@life-os/database';
import { ensureUserDomainProfiles } from './adaptive-domain-service.js';

export function computeDomainTrustFromMetrics(m: {
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

export async function recomputeDomainTrust(userId: string, domainKey: string) {
  await ensureUserDomainProfiles(userId);
  const metrics = await prisma.domainFeedbackMetrics.findUnique({
    where: { userId_domainKey: { userId, domainKey } },
  });
  if (!metrics) return null;
  const trustScore = computeDomainTrustFromMetrics(metrics);
  const updated = await prisma.domainFeedbackMetrics.update({
    where: { userId_domainKey: { userId, domainKey } },
    data: { trustScore },
  });
  return { metrics: updated, trustScore };
}

export async function getDomainTrustSummary(userId: string, domainKey: string) {
  await ensureUserDomainProfiles(userId);
  const metrics = await prisma.domainFeedbackMetrics.findUnique({
    where: { userId_domainKey: { userId, domainKey } },
  });
  const profile = await prisma.userDomainProfile.findUnique({
    where: { userId_domainKey: { userId, domainKey } },
  });
  if (!metrics || !profile) return null;
  return {
    trustScore: metrics.trustScore,
    runtimeState: profile.runtimeState,
    confidence: profile.confidence,
    metrics,
  };
}
