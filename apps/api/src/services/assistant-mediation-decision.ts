import type { AssistantSurfaceType, MediationDecision, UserStateType } from '@prisma/client';

/** Blueprint sensitivity gate (deterministic; no ML). */
export type SensitivityClass = 'safe' | 'moderate' | 'high' | 'very_high';

/** Stable keys for client i18n (`mediation.<key>`). One per branch in `decideMediation`. */
export type MediationReasonKey =
  | 'repeatSuppress'
  | 'trustGateConfirm'
  | 'sensitivityVeryHighPrimary'
  | 'escalateDelivery'
  | 'sensitivityHighPrimary'
  | 'sensitivityHighTile'
  | 'stableHighRankPhone'
  | 'stableLowRankTile'
  | 'overloadedSuppress'
  | 'overloadedWatch'
  | 'recoveryTile'
  | 'transitionDeferWatch'
  | 'transitionImportantPhone'
  | 'defaultPrimary';

export type MediationDecisionInput = {
  state: UserStateType | undefined;
  rank: number;
  confidence: number;
  /** 0–1; lower → prefer ASK over strong surface. Default applied at call site. */
  trustScore: number;
  sensitivityClass: SensitivityClass;
  /** Suggestion dismiss/snooze repetition — blueprint repetition control. */
  dismissCount: number;
};

export type MediationDecisionResult = {
  mediationDecision: MediationDecision;
  targetSurface: AssistantSurfaceType;
  reasonSummary: string;
  /** Machine-stable; localize in web as `mediation.<reasonKey>`. */
  reasonKey: MediationReasonKey;
  outConf: number;
};

const TRUST_ASK = 0.4;
const TRUST_ESCALATE_MIN = 0.45;
const REPEAT_SUPPRESS_AT = 3;
const ESCALATE_RANK = 0.88;
const ESCALATE_CONF = 0.82;

/**
 * Pure, explainable mediation — no I/O. Used by `mediateSuggestion` after loading user state.
 * Applies gates in order: repetition → trust → sensitivity → load/state routing.
 */
export function decideMediation(p: MediationDecisionInput): MediationDecisionResult {
  const { state, rank, confidence: conf, trustScore, sensitivityClass, dismissCount } = p;

  if (dismissCount >= REPEAT_SUPPRESS_AT) {
    return {
      mediationDecision: 'suppress',
      targetSurface: 'silent',
      reasonSummary: 'Repeatedly dismissed; withholding to reduce noise',
      reasonKey: 'repeatSuppress',
      outConf: 0.68,
    };
  }

  if (trustScore < TRUST_ASK) {
    return {
      mediationDecision: 'ask',
      targetSurface: 'phone',
      reasonSummary: 'Trust gate: confirm before strong surfacing',
      reasonKey: 'trustGateConfirm',
      outConf: 0.55,
    };
  }

  if (sensitivityClass === 'very_high') {
    return {
      mediationDecision: 'route_to_phone',
      targetSurface: 'phone',
      reasonSummary: 'Sensitivity gate: high-stakes content routed to primary surface only',
      reasonKey: 'sensitivityVeryHighPrimary',
      outConf: 0.58,
    };
  }

  const overloaded = state === 'overloaded' || state === 'social_drain';

  // Escalate only when signal is strong, user appears available, trust is adequate — never when overloaded
  const canEscalate =
    !overloaded &&
    (state === undefined || state === 'focused' || state === 'admin_ready') &&
    rank >= ESCALATE_RANK &&
    conf >= ESCALATE_CONF &&
    trustScore >= TRUST_ESCALATE_MIN;

  if (canEscalate && sensitivityClass !== 'high') {
    return {
      mediationDecision: 'escalate',
      targetSurface: 'phone',
      reasonSummary: 'High priority + stable attention; escalated delivery',
      reasonKey: 'escalateDelivery',
      outConf: 0.72,
    };
  }

  if (sensitivityClass === 'high') {
    if (rank >= 0.65 && conf >= 0.5) {
      return {
        mediationDecision: 'route_to_phone',
        targetSurface: 'phone',
        reasonSummary: 'Sensitivity gate: detailed handling on primary surface',
        reasonKey: 'sensitivityHighPrimary',
        outConf: 0.56,
      };
    }
    return {
      mediationDecision: 'route_to_tile',
      targetSurface: 'tile',
      reasonSummary: 'Sensitivity gate: ambient summary only on desk tile',
      reasonKey: 'sensitivityHighTile',
      outConf: 0.5,
    };
  }

  // --- User-state-driven routing (moderate / safe sensitivity) ---
  if (!state || state === 'focused' || state === 'admin_ready') {
    if (rank >= 0.65) {
      return {
        mediationDecision: 'route_to_phone',
        targetSurface: 'phone',
        reasonSummary: 'Stable attention; high-rank item routed to primary device',
        reasonKey: 'stableHighRankPhone',
        outConf: 0.55,
      };
    }
    return {
      mediationDecision: 'route_to_tile',
      targetSurface: 'tile',
      reasonSummary: 'Stable attention; lower-rank as ambient tile nudge',
      reasonKey: 'stableLowRankTile',
      outConf: 0.48,
    };
  }

  if (state === 'overloaded' || state === 'social_drain') {
    if (rank < 0.42 || conf < 0.45) {
      return {
        mediationDecision: 'suppress',
        targetSurface: 'silent',
        reasonSummary: 'High load; low-rank/low-confidence suggestion withheld',
        reasonKey: 'overloadedSuppress',
        outConf: 0.62,
      };
    }
    return {
      mediationDecision: 'route_to_watch',
      targetSurface: 'watch',
      reasonSummary: 'High load; routed to lighter companion surface',
      reasonKey: 'overloadedWatch',
      outConf: 0.58,
    };
  }

  if (state === 'recovery' || state === 'low_attention') {
    return {
      mediationDecision: 'route_to_tile',
      targetSurface: 'tile',
      reasonSummary: 'Recovery/low attention; ambient-only delivery',
      reasonKey: 'recoveryTile',
      outConf: 0.54,
    };
  }

  if (state === 'transition' || state === 'fragmented') {
    if (rank < 0.5) {
      return {
        mediationDecision: 'defer',
        targetSurface: 'watch',
        reasonSummary: 'Transition state; defer minor items to lighter surface',
        reasonKey: 'transitionDeferWatch',
        outConf: 0.52,
      };
    }
    return {
      mediationDecision: 'route_to_phone',
      targetSurface: 'phone',
      reasonSummary: 'Transition state; important items still routed to primary',
      reasonKey: 'transitionImportantPhone',
      outConf: 0.5,
    };
  }

  return {
    mediationDecision: 'route_to_phone',
    targetSurface: 'phone',
    reasonSummary: 'Default routing to primary surface',
    reasonKey: 'defaultPrimary',
    outConf: 0.45,
  };
}
