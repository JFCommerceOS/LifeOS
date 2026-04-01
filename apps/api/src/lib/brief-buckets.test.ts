import { describe, expect, it } from 'vitest';
import { partitionObligationsForBrief } from './brief-buckets.js';

describe('partitionObligationsForBrief (Sprint 01)', () => {
  const now = new Date('2026-03-30T12:00:00.000Z');
  const in7 = new Date(now.getTime() + 7 * 86400000);

  it('places first three obligations in do_now and next seven in do_today', () => {
    const obligations = Array.from({ length: 12 }, (_, i) => ({
      id: `o${i}`,
      title: `Task ${i}`,
      dueAt: null as Date | null,
    }));
    const { doNow, doToday, watchWeek } = partitionObligationsForBrief(obligations, now, in7);
    expect(doNow).toHaveLength(3);
    expect(doToday).toHaveLength(7);
    expect(doNow.map((o) => o.id)).toEqual(['o0', 'o1', 'o2']);
    expect(watchWeek).toHaveLength(0);
  });

  it('puts due-within-window leftovers into watch_week', () => {
    const soon = new Date(now.getTime() + 2 * 86400000);
    const obligations = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `o${i}`,
        title: `T${i}`,
        dueAt: null as Date | null,
      })),
      { id: 'w1', title: 'Watch me', dueAt: soon },
    ];
    const { watchWeek } = partitionObligationsForBrief(obligations, now, in7);
    expect(watchWeek.some((o) => o.id === 'w1')).toBe(true);
  });
});
