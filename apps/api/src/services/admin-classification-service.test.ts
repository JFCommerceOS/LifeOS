import { describe, expect, it } from 'vitest';
import { classifyAdminFromText } from './admin-classification-service.js';

describe('classifyAdminFromText', () => {
  it('flags renewal language', () => {
    const r = classifyAdminFromText('Domain renewal expires March 15 — renew license before cut-off.');
    expect(r.adminType).toBe('RENEWAL');
    expect(r.confidence).toBeGreaterThan(0.65);
  });

  it('flags bill language', () => {
    const r = classifyAdminFromText('Invoice #99 — amount due $120 pay by Friday utility statement');
    expect(r.adminType).toBe('BILL');
    expect(r.confidence).toBeGreaterThan(0.65);
  });
});
