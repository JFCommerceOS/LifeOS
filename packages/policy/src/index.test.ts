import { describe, expect, it } from 'vitest';
import { evaluateExportPolicy, evaluateSurfacePolicy, mapDocumentFamilyToDomainClass } from './index.js';

describe('policy engine helpers', () => {
  it('maps document families', () => {
    expect(mapDocumentFamilyToDomainClass('HEALTH')).toBe('HEALTH');
    expect(mapDocumentFamilyToDomainClass('FINANCE_ADMIN')).toBe('FINANCE');
  });

  it('blocks sensitive export on limited device', () => {
    const r = evaluateExportPolicy({
      domainClass: 'HEALTH',
      includeSensitive: true,
      deviceTrust: 'LIMITED',
    });
    expect(r.result).toBe('BLOCK');
  });

  it('redacts watch surface for health by default', () => {
    const r = evaluateSurfacePolicy({
      domainClass: 'HEALTH',
      surface: 'watch',
      deviceTrust: 'TRUSTED',
      watchSensitiveDetailOptIn: false,
    });
    expect(r.result).toBe('ALLOW_WITH_REDACTION');
  });
});
