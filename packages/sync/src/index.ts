/**
 * Hardening Sprint 02 — deterministic conflict precedence and sync helpers (pure, no I/O).
 */

export type EntityKind =
  | 'obligation'
  | 'suggestion'
  | 'memory_node'
  | 'reminder'
  | 'document'
  | 'daily_brief';

/** Precedence rank: lower = wins in a tie-break (user intent first). */
export const OBLIGATION_MUTATION_PRECEDENCE: Record<string, number> = {
  user_resolve: 0,
  user_dismiss: 1,
  user_confirm: 2,
  user_correction: 3,
  admin_lock: 4,
  connector_import: 5,
  recompute_derived: 8,
  background_infer: 9,
};

export function obligationConflictWinner(
  aType: string,
  bType: string,
): 'a' | 'b' | 'review' {
  const ra = OBLIGATION_MUTATION_PRECEDENCE[aType] ?? 50;
  const rb = OBLIGATION_MUTATION_PRECEDENCE[bType] ?? 50;
  if (ra < rb) return 'a';
  if (rb < ra) return 'b';
  return 'review';
}

export function buildDedupeKey(parts: {
  userId: string;
  jobType: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}): string {
  const tail = [parts.linkedEntityType ?? '', parts.linkedEntityId ?? ''].join(':');
  return `${parts.userId}:${parts.jobType}:${tail}`;
}

export function nextVersion(current: number): number {
  return Math.max(1, current + 1);
}
