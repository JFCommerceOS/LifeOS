import { describe, expect, it } from 'vitest';
import { daysSinceIso, everyoneAdvancedGateKind } from './everyone-advanced-gate';

describe('everyoneAdvancedGateKind', () => {
  it('maps advanced paths to stable kinds', () => {
    expect(everyoneAdvancedGateKind('/twin')).toBe('copilot');
    expect(everyoneAdvancedGateKind('/people')).toBe('people');
    expect(everyoneAdvancedGateKind('/people/x')).toBe('people');
    expect(everyoneAdvancedGateKind('/profile/priority')).toBe('profileTools');
    expect(everyoneAdvancedGateKind('/documents')).toBe('documents');
    expect(everyoneAdvancedGateKind('/connectors/c1')).toBe('connectors');
  });

  it('returns null for core Everyone routes', () => {
    expect(everyoneAdvancedGateKind('/')).toBeNull();
    expect(everyoneAdvancedGateKind('/suggestions')).toBeNull();
    expect(everyoneAdvancedGateKind('/notes')).toBeNull();
    expect(everyoneAdvancedGateKind('/settings')).toBeNull();
  });
});

describe('daysSinceIso', () => {
  it('returns Infinity for missing date', () => {
    expect(daysSinceIso(null)).toBe(Infinity);
    expect(daysSinceIso(undefined)).toBe(Infinity);
  });

  it('measures elapsed days', () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(daysSinceIso(past)).toBeGreaterThanOrEqual(2.9);
    expect(daysSinceIso(past)).toBeLessThan(3.5);
  });
});
