import type { BriefBucket, MediationDecision } from '@prisma/client';

/** Map deterministic mediation output to Daily Brief bucket (Sprint 03). */
export function mediationDecisionToBriefBucket(
  decision: MediationDecision,
  ob: { dueAt: Date | null; suppressionUntil: Date | null },
  now: Date,
): BriefBucket | null {
  if (ob.suppressionUntil && ob.suppressionUntil > now) return null;

  if (decision === 'suppress') return null;

  if (decision === 'defer') return 'watch_week';

  if (decision === 'ask' || decision === 'route_to_phone' || decision === 'route_to_tile' || decision === 'route_to_watch') {
    return 'needs_confirmation';
  }

  if (decision === 'surface_now' || decision === 'escalate' || decision === 'nudge') {
    if (ob.dueAt && (ob.dueAt <= now || ob.dueAt.getTime() - now.getTime() < 36 * 3600000)) {
      return 'do_now';
    }
    return 'do_today';
  }

  return 'watch_week';
}
