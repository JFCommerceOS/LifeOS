import { describe, expect, it } from 'vitest';
import { computeBriefPriority } from './brief-engine.js';

describe('computeBriefPriority (Sprint 02)', () => {
  const now = new Date('2026-03-30T12:00:00.000Z');

  it('ranks overdue above future', () => {
    const past = new Date('2026-03-29T12:00:00.000Z');
    const future = new Date('2026-04-15T12:00:00.000Z');
    expect(computeBriefPriority({ dueAt: past, confidence: 0.5, obligationType: 'FOLLOW_UP' }, now)).toBeGreaterThan(
      computeBriefPriority({ dueAt: future, confidence: 0.5, obligationType: 'FOLLOW_UP' }, now),
    );
  });

  it('boosts deadline-type obligations', () => {
    const d = new Date('2026-04-01T12:00:00.000Z');
    const base = computeBriefPriority({ dueAt: d, confidence: 0.6, obligationType: 'FOLLOW_UP' }, now);
    const dl = computeBriefPriority({ dueAt: d, confidence: 0.6, obligationType: 'DEADLINE' }, now);
    expect(dl).toBeGreaterThan(base);
  });
});
