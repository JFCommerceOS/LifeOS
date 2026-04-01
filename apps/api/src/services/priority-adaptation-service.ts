import type { BriefDensityPreference, MainLifeMode, UprPrivacySensitivity, UprReminderStyle } from '@prisma/client';
import { prisma } from '@life-os/database';
import {
  classifyObligationDomain,
  mergeDeclaredAndInferredWeights,
  modeDomainAffinity,
  parseDomainWeightsJson,
} from '../lib/upr-domain-weights.js';
import { getEffectiveLifeMode } from './life-mode-service.js';
import { loadInferredWeightDeltas } from './profile-inference-service.js';

export type UprModifierContext = {
  effectiveMode: MainLifeMode;
  modeSource: 'manual' | 'default';
  domainWeights: Record<string, number>;
  lowConfidenceRankMultiplier: number;
  briefDensity: BriefDensityPreference;
  reminderStyle: UprReminderStyle;
  escalationHours: number | null;
  privacySensitivity: UprPrivacySensitivity;
};

export async function loadUprModifierContext(userId: string): Promise<UprModifierContext> {
  const [profile, effective, inferredLowConf, inferredDelta] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    getEffectiveLifeMode(userId),
    prisma.inferredPreferenceState.findFirst({
      where: { userId, preferenceKey: 'low_confidence_surfacing', status: 'active' },
      orderBy: { updatedAt: 'desc' },
    }),
    loadInferredWeightDeltas(userId),
  ]);

  const declared = parseDomainWeightsJson(profile?.priorityDomainWeightsJson);
  const weights = mergeDeclaredAndInferredWeights(declared, inferredDelta);
  let lowConfidenceRankMultiplier = 1;
  if (inferredLowConf?.inferredValueJson) {
    try {
      const j = JSON.parse(inferredLowConf.inferredValueJson) as { rankMultiplier?: number };
      if (typeof j.rankMultiplier === 'number' && j.rankMultiplier > 0 && j.rankMultiplier <= 1.05) {
        lowConfidenceRankMultiplier = j.rankMultiplier;
      }
    } catch {
      /* ignore */
    }
  }

  return {
    effectiveMode: effective.mode,
    modeSource: effective.source,
    domainWeights: weights,
    lowConfidenceRankMultiplier,
    briefDensity: profile?.preferredBriefDensity ?? 'BALANCED',
    reminderStyle: profile?.uprReminderStyle ?? 'CALM',
    escalationHours: profile?.preferredEscalationWindowHours ?? null,
    privacySensitivity: profile?.uprPrivacySensitivity ?? 'STANDARD',
  };
}

export function applyUprToBriefPriority(
  baseScore: number,
  ob: { title: string; confidence: number; obligationType: string | null },
  ctx: UprModifierContext,
): { score: number; domain: string; domainWeight: number; modeAffinity: number } {
  const domain = classifyObligationDomain(ob);
  const dw = ctx.domainWeights[domain] ?? 1;
  const mm = modeDomainAffinity(ctx.effectiveMode, domain);
  let score = baseScore * dw * mm;
  if (ob.confidence < 0.45) score *= ctx.lowConfidenceRankMultiplier;
  return { score, domain, domainWeight: dw, modeAffinity: mm };
}

export async function snapshotPriorityProfile(userId: string, ctx: UprModifierContext, trigger: string): Promise<void> {
  await prisma.priorityProfileSnapshot.create({
    data: {
      userId,
      activeMode: ctx.effectiveMode,
      rankingWeightsJson: JSON.stringify(ctx.domainWeights),
      triggerReason: trigger,
    },
  });
}
