import { describe, expect, it } from 'vitest';
import { maskDigits } from './redaction-service.js';

describe('maskDigits', () => {
  it('masks long digit strings', () => {
    expect(maskDigits('1234567890', 4)).toContain('7890');
  });
});
