/** Minimal event prep shape from `assembleEventContext`. */
export type EventPrepContextShape = {
  participants: unknown[];
  priorNotes: unknown[];
  openObligations: unknown[];
  lastDiscussed: unknown | null;
};

/** Deterministic 0–1 score for prep confidence (Sprint 06). */
export function scoreEventPrepRelevance(ctx: EventPrepContextShape): number {
  let s = 0.45;
  if (ctx.participants.length > 0) s += 0.18;
  if (ctx.openObligations.length > 0) s += 0.2;
  if (ctx.priorNotes.length > 0) s += 0.12;
  if (ctx.lastDiscussed) s += 0.08;
  return Math.min(0.94, s);
}
