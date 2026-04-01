import { describe, expect, it } from 'vitest';
import { normalizeSignalEnvelope } from './signal-normalization-service.js';

describe('normalizeSignalEnvelope', () => {
  it('extracts text from JSON body field', () => {
    const n = normalizeSignalEnvelope({
      signalType: 'NOTE_CAPTURE',
      rawPayloadJson: JSON.stringify({ body: 'Reply to Alex by Friday' }),
    });
    expect(n.normalizedText).toContain('Reply to Alex');
    const topics = JSON.parse(n.candidateTopicsJson) as string[];
    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThanOrEqual(0);
  });

  it('falls back to string payload when JSON invalid', () => {
    const n = normalizeSignalEnvelope({
      signalType: 'NOTE_CAPTURE',
      rawPayloadJson: 'plain note text',
    });
    expect(n.normalizedText).toBe('plain note text');
  });
});
