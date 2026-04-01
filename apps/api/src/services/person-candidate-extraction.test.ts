import { describe, expect, it } from 'vitest';
import { extractPersonCandidatesFromText, extractPrimaryNameFromEventTitle } from './person-candidate-extraction.js';

describe('extractPrimaryNameFromEventTitle', () => {
  it('parses meeting with phrase', () => {
    expect(extractPrimaryNameFromEventTitle('Meeting with Sam — Friday')).toBe('Sam');
    expect(extractPrimaryNameFromEventTitle('Call with Dr. Smith about taxes')).toContain('Dr. Smith');
  });

  it('returns null when no pattern', () => {
    expect(extractPrimaryNameFromEventTitle('Standup')).toBeNull();
  });
});

describe('extractPersonCandidatesFromText', () => {
  it('collects capitalized tokens', () => {
    const c = extractPersonCandidatesFromText('Follow up with Sarah before Monday on Project Phoenix');
    expect(c.some((x) => x === 'Sarah')).toBe(true);
    expect(c.some((x) => x === 'Monday')).toBe(false);
  });
});
