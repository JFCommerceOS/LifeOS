import { describe, expect, it } from 'vitest';
import {
  extractDeadlineCandidates,
  extractPersonCandidates,
  inferDueDateFromCandidates,
  nextWeekdayFromName,
} from './deterministic-intake-parsing.js';

describe('deterministic-intake-parsing (Sprint 02)', () => {
  it('extracts person candidates from with/reply/call patterns', () => {
    const t = 'Follow up with Sam before Friday and reply to Alex';
    const p = extractPersonCandidates(t);
    expect(p.some((x) => x.label.includes('Sam'))).toBe(true);
    expect(p.some((x) => x.label.includes('Alex'))).toBe(true);
  });

  it('extracts deadline tokens', () => {
    const t = 'Need review by Friday and tomorrow';
    const d = extractDeadlineCandidates(t);
    expect(d.some((x) => x.token === 'friday')).toBe(true);
    expect(d.some((x) => x.token === 'tomorrow')).toBe(true);
  });

  it('infers due date from Friday token', () => {
    const ref = new Date('2026-03-30T12:00:00.000Z');
    const d = extractDeadlineCandidates('before Friday');
    const due = inferDueDateFromCandidates(d, ref);
    expect(due).toBeTruthy();
    expect(due!.getUTCDay()).toBe(nextWeekdayFromName('friday', ref)!.getUTCDay());
  });
});
