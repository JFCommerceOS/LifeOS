import { prisma } from '@life-os/database';
import {
  decideMediation,
  type MediationDecisionInput,
  type SensitivityClass,
} from './assistant-mediation-decision.js';
import { appendDomainToneToReasonSummary } from './domain-tone-service.js';
import { loadDerivedMediationHints } from './mediation-derived-inputs.js';
import { syncNotificationFromMediation } from './notification-from-mediation.js';

export type MediateInput = {
  userId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  rank: number;
  confidence: number;
  /** 0–1. Omitted → derived from surface policies + settings. */
  trustScore?: number;
  /** Omitted → derived from privacy + watch policy. */
  sensitivityClass?: SensitivityClass;
  /** From suggestion lifecycle (dismissals). Omitted → 0. */
  dismissCount?: number;
  /** Sprint 03 — lineage to obligation when mediating a suggestion tied to one. */
  linkedObligationId?: string | null;
};

const DEFAULT_TRUST = 0.72;

/** Rank from suggestion engine may be 0–100; mediation core expects 0–1. */
export function normalizeMediationRank(rank: number): number {
  if (rank > 1) return Math.min(1, Math.max(0, rank / 100));
  return Math.min(1, Math.max(0, rank));
}

function buildDecisionInput(
  state: MediationDecisionInput['state'],
  input: MediateInput,
): MediationDecisionInput {
  return {
    state,
    rank: input.rank,
    confidence: input.confidence,
    trustScore: input.trustScore ?? DEFAULT_TRUST,
    sensitivityClass: input.sensitivityClass ?? 'safe',
    dismissCount: input.dismissCount ?? 0,
  };
}

export async function mediateSuggestion(input: MediateInput, options?: { persistLog?: boolean }) {
  const persistLog = options?.persistLog !== false;
  const [snapshot, derived] = await Promise.all([
    prisma.userStateSnapshot.findFirst({
      where: { userId: input.userId },
      orderBy: { detectedAt: 'desc' },
    }),
    loadDerivedMediationHints(input.userId),
  ]);

  const state = snapshot?.stateType;
  const resolved: MediateInput = {
    ...input,
    rank: normalizeMediationRank(input.rank),
    trustScore: input.trustScore ?? derived.trustScore,
    sensitivityClass: input.sensitivityClass ?? derived.sensitivityClass,
  };

  const raw = decideMediation(buildDecisionInput(state, resolved));
  const tone = await appendDomainToneToReasonSummary(raw.reasonSummary, input.userId);
  const reasonSummary = tone.text;

  const inputsSnapshotJson = JSON.stringify({
    rank: resolved.rank,
    confidence: input.confidence,
    trustScore: resolved.trustScore,
    dismissCount: resolved.dismissCount,
    linkedObligationId: input.linkedObligationId ?? null,
    userState: state ?? null,
  });

  let logId: string | null = null;
  if (persistLog) {
    const log = await prisma.assistantMediationLog.create({
      data: {
        userId: input.userId,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        mediationDecision: raw.mediationDecision,
        targetSurface: raw.targetSurface,
        reasonSummary,
        confidence: raw.outConf,
        linkedObligationId: input.linkedObligationId ?? undefined,
        inputsSnapshotJson,
      },
    });
    logId = log.id;
    void syncNotificationFromMediation({
      userId: input.userId,
      mediationLogId: log.id,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      mediationDecision: raw.mediationDecision,
      targetSurface: raw.targetSurface,
      reasonSummary,
      confidence: raw.outConf,
      linkedObligationId: input.linkedObligationId ?? null,
    }).catch(() => undefined);
  }

  return {
    mediationDecision: raw.mediationDecision,
    targetSurface: raw.targetSurface,
    reasonSummary,
    reasonKey: raw.reasonKey,
    mediationToneKey: tone.toneKey,
    confidence: raw.outConf,
    logId,
  };
}

/** Re-export for tests and policy tooling. */
export { decideMediation };
export type {
  MediationDecisionInput,
  MediationDecisionResult,
  MediationReasonKey,
  SensitivityClass,
} from './assistant-mediation-decision.js';
