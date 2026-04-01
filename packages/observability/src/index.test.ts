import { describe, expect, it } from 'vitest';
import { buildExplanationPayload, summarizeForTrace } from './index.js';

describe('observability', () => {
  it('builds explanation payload', () => {
    const p = buildExplanationPayload({
      reasonType: 'user_dismissed',
      summary: 'User dismissed',
      triggerRef: 'mut_1',
    });
    expect(p.reasonType).toBe('user_dismissed');
    expect(p.triggerRef).toBe('mut_1');
  });

  it('summarizes long trace text', () => {
    const long = 'x'.repeat(600);
    expect(summarizeForTrace(long, 20).length).toBeLessThanOrEqual(21);
  });
});
