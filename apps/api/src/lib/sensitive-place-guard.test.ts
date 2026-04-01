import { describe, expect, it } from 'vitest';
import { placeEventExcludedFromPatternInsights } from './sensitive-place-guard.js';

describe('sensitive-place-guard', () => {
  it('excludes masked events', () => {
    expect(
      placeEventExcludedFromPatternInsights({ masked: true, savedPlace: null }),
    ).toBe(true);
  });

  it('excludes private_sensitive saved places', () => {
    expect(
      placeEventExcludedFromPatternInsights({
        masked: false,
        savedPlace: { sensitivity: 'private_sensitive', defaultMasked: false },
      }),
    ).toBe(true);
  });

  it('excludes defaultMasked catalog rows', () => {
    expect(
      placeEventExcludedFromPatternInsights({
        masked: false,
        savedPlace: { sensitivity: 'normal', defaultMasked: true },
      }),
    ).toBe(true);
  });

  it('keeps normal home work when not default masked', () => {
    expect(
      placeEventExcludedFromPatternInsights({
        masked: false,
        savedPlace: { sensitivity: 'home', defaultMasked: false },
      }),
    ).toBe(false);
    expect(
      placeEventExcludedFromPatternInsights({
        masked: false,
        savedPlace: null,
      }),
    ).toBe(false);
  });
});
