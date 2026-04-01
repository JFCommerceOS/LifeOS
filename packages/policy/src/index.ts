/**
 * Hardening Sprint 01 — pure policy evaluation (no I/O).
 * Aligns with Prisma enums DomainClass, PolicyEngineResult, etc.
 */

export type DocumentFamilyHint =
  | 'HEALTH'
  | 'FINANCE_ADMIN'
  | 'EDUCATION'
  | 'GENERIC'
  | 'UNKNOWN';

export type DeviceTrustHint = 'PENDING' | 'TRUSTED' | 'LIMITED' | 'REVOKED';

export type PolicySurfaceHint = 'phone' | 'watch' | 'desktop' | 'lock_screen' | 'daily_brief';

export type PolicyEngineResult =
  | 'ALLOW'
  | 'ALLOW_WITH_REDACTION'
  | 'ALLOW_AFTER_CONFIRMATION'
  | 'BLOCK'
  | 'LOCAL_ONLY'
  | 'ARCHIVE_ONLY';

export function mapDocumentFamilyToDomainClass(family: DocumentFamilyHint): string {
  switch (family) {
    case 'HEALTH':
      return 'HEALTH';
    case 'FINANCE_ADMIN':
      return 'FINANCE';
    case 'EDUCATION':
      return 'EDUCATION';
    default:
      return 'GENERAL';
  }
}

/** Storage rule: health/finance raw-adjacent classes prefer encrypted-at-rest flag (enforced by app layers). */
export function evaluateStoragePolicy(args: {
  domainClass: string;
  userMarkedLocalOnly: boolean;
  userMarkedArchiveOnly: boolean;
}): { result: PolicyEngineResult; reasonCode: string } {
  if (args.userMarkedArchiveOnly) {
    return { result: 'ARCHIVE_ONLY', reasonCode: 'user_archive_only' };
  }
  if (args.userMarkedLocalOnly) {
    return { result: 'LOCAL_ONLY', reasonCode: 'user_local_only' };
  }
  if (args.domainClass === 'HEALTH' || args.domainClass === 'FINANCE') {
    return { result: 'ALLOW', reasonCode: 'sensitive_encrypted_class' };
  }
  return { result: 'ALLOW', reasonCode: 'standard_storage' };
}

export function evaluateSurfacePolicy(args: {
  domainClass: string;
  surface: PolicySurfaceHint;
  deviceTrust: DeviceTrustHint;
  watchSensitiveDetailOptIn: boolean;
}): { result: PolicyEngineResult; reasonCode: string } {
  if (args.deviceTrust === 'REVOKED' || args.deviceTrust === 'PENDING') {
    return { result: 'BLOCK', reasonCode: 'device_not_trusted' };
  }
  if (args.domainClass === 'HEALTH' || args.domainClass === 'FINANCE') {
    if (args.surface === 'watch' && !args.watchSensitiveDetailOptIn) {
      return { result: 'ALLOW_WITH_REDACTION', reasonCode: 'watch_redact_sensitive_default' };
    }
    if (args.surface === 'lock_screen') {
      return { result: 'ALLOW_WITH_REDACTION', reasonCode: 'lock_screen_no_sensitive_detail' };
    }
  }
  return { result: 'ALLOW', reasonCode: 'surface_ok' };
}

export function evaluateExportPolicy(args: {
  domainClass: string;
  includeSensitive: boolean;
  deviceTrust: DeviceTrustHint;
}): { result: PolicyEngineResult; reasonCode: string } {
  if (args.deviceTrust === 'REVOKED' || args.deviceTrust === 'PENDING') {
    return { result: 'BLOCK', reasonCode: 'export_requires_trusted_device' };
  }
  if ((args.domainClass === 'HEALTH' || args.domainClass === 'FINANCE') && args.includeSensitive) {
    if (args.deviceTrust === 'LIMITED') {
      return { result: 'BLOCK', reasonCode: 'sensitive_export_blocked_on_limited_device' };
    }
  }
  return { result: 'ALLOW', reasonCode: 'export_allowed' };
}
