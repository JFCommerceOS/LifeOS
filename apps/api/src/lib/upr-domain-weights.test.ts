import { describe, expect, it } from 'vitest';
import {
  classifyObligationDomain,
  mergeDeclaredAndInferredWeights,
  modeDomainAffinity,
  parseDomainWeightsJson,
} from './upr-domain-weights.js';

describe('upr-domain-weights', () => {
  it('parses and ignores out-of-range keys', () => {
    const w = parseDomainWeightsJson('{"study":1.5,"work":99}');
    expect(w.study).toBe(1.5);
    expect(w.work).toBe(1);
  });

  it('classifies study-like titles', () => {
    expect(
      classifyObligationDomain({ title: 'Finish CS101 assignment', obligationType: null }),
    ).toBe('study');
  });

  it('mode boosts matching domain', () => {
    expect(modeDomainAffinity('STUDY', 'study')).toBeGreaterThan(1);
    expect(modeDomainAffinity('STUDY', 'admin')).toBe(1);
  });

  it('merges inferred deltas without going below floor', () => {
    const m = mergeDeclaredAndInferredWeights(
      { work: 1, study: 1, admin: 1, personal: 1, health_tracking: 1 },
      { study: -0.5 },
    );
    expect(m.study).toBe(0.5);
  });
});
