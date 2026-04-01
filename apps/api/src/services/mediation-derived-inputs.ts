import { prisma } from '@life-os/database';
import type { SensitivityClass } from './assistant-mediation-decision.js';
import { listSurfacePolicies } from './surface-orchestration-service.js';

export type DerivedMediationHints = {
  trustScore: number;
  sensitivityClass: SensitivityClass;
};

/**
 * Single source of truth for default trust/sensitivity when callers omit them.
 * Maps surface delivery policies + privacy settings to mediation heuristics (explainable, deterministic).
 */
export async function loadDerivedMediationHints(userId: string): Promise<DerivedMediationHints> {
  const [settings, policies] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    listSurfacePolicies(userId),
  ]);

  const phone = policies.find((p) => p.surfaceType === 'phone');
  const watch = policies.find((p) => p.surfaceType === 'watch');
  const urgencyAvg =
    phone && watch
      ? (phone.urgencyThreshold + watch.urgencyThreshold) / 2
      : phone?.urgencyThreshold ?? 0.5;

  // Higher urgency threshold = user only wants stronger signals → slightly higher trust in rank-based filtering.
  let trustScore = 0.55 + 0.35 * Math.min(1, Math.max(0, urgencyAvg));
  if (settings?.predictiveModeOptIn) trustScore = Math.min(0.95, trustScore + 0.04);
  trustScore = Math.min(0.95, Math.max(0.4, trustScore));

  let sensitivityClass: SensitivityClass = 'safe';
  if (settings?.privacyStrictMode) sensitivityClass = 'high';
  const watchStrict = watch?.privacyMode === 'strict';
  if (watchStrict && sensitivityClass === 'safe') sensitivityClass = 'moderate';

  return { trustScore, sensitivityClass };
}
