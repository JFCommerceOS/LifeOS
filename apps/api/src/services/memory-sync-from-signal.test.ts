import { describe, expect, it } from 'vitest';
import { signalTypeToMemoryNodeType } from './memory-sync-from-signal.js';

describe('signalTypeToMemoryNodeType', () => {
  it('maps known signal kinds', () => {
    expect(signalTypeToMemoryNodeType('NOTE_CAPTURE')).toBe('NOTE');
    expect(signalTypeToMemoryNodeType('CALENDAR_EVENT')).toBe('EVENT');
    expect(signalTypeToMemoryNodeType('RELATIONSHIP_SIGNAL')).toBe('PERSON');
    expect(signalTypeToMemoryNodeType('EMAIL_THREAD_METADATA')).toBe('NOTE');
  });
});
