import type { ObligationStatus } from '@prisma/client';

/** Obligations that still participate in continuity surfacing (Sprint 03). */
export const ACTIVE_OBLIGATION_STATUSES: readonly ObligationStatus[] = [
  'open',
  'confirmed',
  'reopened',
] as const;

export function isActiveObligationStatus(status: ObligationStatus): boolean {
  return (ACTIVE_OBLIGATION_STATUSES as readonly string[]).includes(status);
}
