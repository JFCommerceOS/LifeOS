import { describe, expect, it } from 'vitest';
import { detectObligationsFromText } from './extraction.js';

describe('detectObligationsFromText (MVP pack §12.2)', () => {
  it('detects follow-up and deadline cues', () => {
    const t = 'Follow up with Sam before Friday — need to send the doc.';
    const o = detectObligationsFromText(t);
    expect(o.length).toBeGreaterThan(0);
    expect(o.join(' ').toLowerCase()).toMatch(/follow|deadline|action|send|review/i);
  });

  it('Sprint 01 proof phrase yields at least one obligation cue', () => {
    const t = 'Follow up with Sam before Friday';
    expect(detectObligationsFromText(t).length).toBeGreaterThan(0);
  });

  it('returns empty for inert text', () => {
    expect(detectObligationsFromText('the weather is nice')).toEqual([]);
  });
});
