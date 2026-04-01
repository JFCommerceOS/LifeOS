/**
 * Hardening Sprint 02 — lease windows, coalescing, retry backoff (pure).
 */

const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_COALESCE_MS = 5_000;
const MAX_RETRY = 8;

export function leaseExpiresAt(now: Date, leaseMs = DEFAULT_LEASE_MS): Date {
  return new Date(now.getTime() + leaseMs);
}

export function isLeaseExpired(leaseExpiresAt: Date | null | undefined, now: Date): boolean {
  if (!leaseExpiresAt) return true;
  return leaseExpiresAt.getTime() <= now.getTime();
}

/** Coalesce key: events inside window map to same bucket time. */
export function coalesceScheduledTime(now: Date, windowMs = DEFAULT_COALESCE_MS): Date {
  const t = now.getTime();
  const bucket = Math.floor(t / windowMs) * windowMs;
  return new Date(bucket + windowMs);
}

export function nextRetryAt(
  now: Date,
  retryCount: number,
  baseMs = 2_000,
  maxMs = 3600_000,
): Date | null {
  if (retryCount >= MAX_RETRY) return null;
  const exp = Math.min(maxMs, baseMs * 2 ** retryCount);
  const jitter = Math.floor(Math.random() * Math.min(500, exp / 4));
  return new Date(now.getTime() + exp + jitter);
}

export { MAX_RETRY as maxSchedulingRetries };
