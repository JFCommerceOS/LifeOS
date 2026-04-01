import { describe, expect, it } from 'vitest';
import {
  coalesceScheduledTime,
  isLeaseExpired,
  leaseExpiresAt,
  nextRetryAt,
} from './index.js';

describe('scheduling', () => {
  it('leaseExpiresAt is in the future', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const end = leaseExpiresAt(now, 30_000);
    expect(end.getTime() - now.getTime()).toBe(30_000);
  });

  it('isLeaseExpired', () => {
    const now = new Date();
    expect(isLeaseExpired(new Date(now.getTime() - 1000), now)).toBe(true);
    expect(isLeaseExpired(new Date(now.getTime() + 60_000), now)).toBe(false);
  });

  it('coalesceScheduledTime bumps to next window boundary', () => {
    const now = new Date(10_000);
    const c = coalesceScheduledTime(now, 5000);
    expect(c.getTime()).toBe(15_000);
  });

  it('nextRetryAt returns null after many retries', () => {
    const now = new Date();
    expect(nextRetryAt(now, 100)).toBeNull();
  });
});
