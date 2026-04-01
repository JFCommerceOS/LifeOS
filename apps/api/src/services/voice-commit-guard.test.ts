import { describe, expect, it } from 'vitest';
import { WEAK_TRANSCRIPT_CONFIDENCE, weakTranscriptNeedsReview } from './voice-commit-guard.js';

describe('voice-commit-guard', () => {
  it('flags confidence below threshold', () => {
    expect(weakTranscriptNeedsReview(WEAK_TRANSCRIPT_CONFIDENCE - 0.01)).toBe(true);
    expect(weakTranscriptNeedsReview(WEAK_TRANSCRIPT_CONFIDENCE)).toBe(false);
    expect(weakTranscriptNeedsReview(0.9)).toBe(false);
  });
});
