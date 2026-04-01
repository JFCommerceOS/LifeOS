import { prisma } from '@life-os/database';
import type { CapabilityRuntimeState } from '@prisma/client';
import { getCatalogEntry } from './capability-catalog.js';
import { ensureUserCapabilities, patchCapabilityState } from './capability-registry-service.js';
import { getTrustSummary } from './capability-trust-service.js';

export type ActivationEvaluation = {
  canBecomeActive: boolean;
  reasons: string[];
  runtimeState: CapabilityRuntimeState;
  trustScore: number;
  trustThreshold: number;
};

/** Evaluate whether passive → active is allowed (permission + trust + confidence thresholds). */
export async function evaluateActivationReadiness(
  userId: string,
  capabilityKey: string,
  confidence?: number,
): Promise<ActivationEvaluation> {
  await ensureUserCapabilities(userId);
  const reasons: string[] = [];
  const reg = await prisma.userCapabilityRegistry.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  const policy = await prisma.capabilityBehaviorPolicy.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  if (!reg || !policy) {
    return {
      canBecomeActive: false,
      reasons: ['missing_registry'],
      runtimeState: 'not_enabled',
      trustScore: 0,
      trustThreshold: 0.4,
    };
  }

  if (reg.runtimeState === 'not_enabled') {
    reasons.push('capability_not_enabled_grant_purpose_permission_first');
    return {
      canBecomeActive: false,
      reasons,
      runtimeState: reg.runtimeState,
      trustScore: reg.trustScore,
      trustThreshold: policy.trustThreshold,
    };
  }

  const trust = await getTrustSummary(userId, capabilityKey);
  if (!trust?.meetsTrustThreshold) {
    reasons.push('trust_below_threshold');
  }
  if (confidence != null && confidence < policy.confidenceThreshold) {
    reasons.push('confidence_below_threshold');
  }

  const def = getCatalogEntry(capabilityKey);
  if (def?.dataSourcesRequired.includes('location') || def?.dataSourcesRequired.includes('screen_time_summary')) {
    const granted = await prisma.capabilityPermission.findFirst({
      where: { userId, capabilityKey, granted: true, revokedAt: null },
    });
    if (!granted) {
      reasons.push('purpose_permission_not_recorded');
    }
  }

  const canBecomeActive =
    reg.runtimeState === 'passive' &&
    reasons.length === 0 &&
    (trust?.meetsTrustThreshold ?? false) &&
    (confidence == null || confidence >= policy.confidenceThreshold);

  return {
    canBecomeActive,
    reasons: canBecomeActive ? ['ready'] : reasons,
    runtimeState: reg.runtimeState,
    trustScore: reg.trustScore,
    trustThreshold: policy.trustThreshold,
  };
}

export async function proposeActivateIfReady(
  userId: string,
  capabilityKey: string,
  confidence?: number,
  triggeredBy = 'system',
) {
  const ev = await evaluateActivationReadiness(userId, capabilityKey, confidence);
  if (!ev.canBecomeActive || ev.runtimeState !== 'passive') {
    return { updated: false as const, evaluation: ev };
  }
  const updated = await patchCapabilityState(
    userId,
    capabilityKey,
    'active',
    triggeredBy,
    'Trust and confidence thresholds met',
  );
  return { updated: true as const, registry: updated, evaluation: ev };
}
