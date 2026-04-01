import { describe, expect, it } from 'vitest';
import {
  buildDedupeKey,
  nextVersion,
  obligationConflictWinner,
} from './index.js';

describe('sync', () => {
  it('user dismiss beats recompute', () => {
    expect(obligationConflictWinner('user_dismiss', 'recompute_derived')).toBe('a');
    expect(obligationConflictWinner('recompute_derived', 'user_dismiss')).toBe('b');
  });

  it('dedupe key is stable', () => {
    expect(buildDedupeKey({ userId: 'u1', jobType: 'projection_refresh', linkedEntityType: 'Obligation', linkedEntityId: 'x' })).toBe(
      'u1:projection_refresh:Obligation:x',
    );
  });

  it('nextVersion', () => {
    expect(nextVersion(3)).toBe(4);
    expect(nextVersion(0)).toBe(1);
  });
});
