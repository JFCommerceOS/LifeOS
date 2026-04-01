/**
 * Hardening Sprint 02 — trace/explanation payloads (summaries only; no raw sensitive payloads).
 */

export type ExplanationReasonType =
  | 'surfaced_rank'
  | 'suppressed_policy'
  | 'user_dismissed'
  | 'projection_refresh'
  | 'conflict_resolved'
  | 'sync_blocked';

export function buildExplanationPayload(input: {
  reasonType: ExplanationReasonType | string;
  summary: string;
  triggerRef?: string | null;
  policyConstraint?: string | null;
}): Record<string, unknown> {
  return {
    reasonType: input.reasonType,
    summary: input.summary,
    triggerRef: input.triggerRef ?? undefined,
    policyConstraint: input.policyConstraint ?? undefined,
  };
}

const MAX_SUMMARY = 512;

/** Reduces free text for trace tables (Rule 2). */
export function summarizeForTrace(text: string | undefined | null, maxLen = MAX_SUMMARY): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
