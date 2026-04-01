import { describe, expect, it } from 'vitest';
import { canonicalHashForPayload } from './source-record-ingestion-service.js';

describe('canonicalHashForPayload', () => {
  it('is stable for key order', () => {
    const a = canonicalHashForPayload({ z: 1, a: 2 });
    const b = canonicalHashForPayload({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it('changes when values change', () => {
    const a = canonicalHashForPayload({ x: '1' });
    const b = canonicalHashForPayload({ x: '2' });
    expect(a).not.toBe(b);
  });
});
