import { describe, expect, it } from 'vitest';
import { isInsideQuietHours, minutesNowInTimeZone, parseHm } from './notification-quiet-hours.js';

describe('notification-quiet-hours', () => {
  it('parseHm accepts HH:mm', () => {
    expect(parseHm('22:30')).toBe(22 * 60 + 30);
    expect(parseHm('bad')).toBeNull();
  });

  it('detects window within same day', () => {
    const d = new Date('2026-03-30T23:00:00.000Z');
    expect(isInsideQuietHours(d, 'UTC', '22:00', '07:00')).toBe(true);
    expect(isInsideQuietHours(d, 'UTC', '08:00', '20:00')).toBe(false);
  });

  it('minutesNowInTimeZone is stable for UTC', () => {
    const d = new Date('2026-03-30T15:30:00.000Z');
    expect(minutesNowInTimeZone(d, 'UTC')).toBe(15 * 60 + 30);
  });
});
