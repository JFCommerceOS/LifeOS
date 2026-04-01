import type { UserProfile } from '@prisma/client';

/** Light tuning for suggestion rank from profile (Phase 3) — assistive, not psychographic. */
export function profileRankMultiplier(profile: UserProfile | null): number {
  if (!profile) return 1;
  let m = 1;
  if (profile.nudgeStyle === 'strict') m *= 1.03;
  if (profile.nudgeStyle === 'gentle') m *= 0.97;
  if (profile.notificationDensity === 'low') m *= 0.95;
  if (profile.notificationDensity === 'high') m *= 1.03;
  return m;
}
