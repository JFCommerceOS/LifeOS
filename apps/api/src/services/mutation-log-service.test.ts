import { describe, expect, it } from 'vitest';
import { mapLifecycleToMutationType } from './mutation-log-service.js';

describe('mutation-log-service', () => {
  it('maps lifecycle actions', () => {
    expect(mapLifecycleToMutationType('dismiss')).toBe('user_dismiss');
    expect(mapLifecycleToMutationType('resolve')).toBe('user_resolve');
  });
});
