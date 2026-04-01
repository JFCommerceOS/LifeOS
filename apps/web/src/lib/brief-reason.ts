import type { TFunction } from 'i18next';

const LEGACY_FROM_FACTS = /^From facts:\s*(.+)$/i;

/** Comma-separated fact type codes (e.g. FOLLOW_UP_CUE, DATE_REFERENCE). */
const FACT_TYPES_ONLY = /^[A-Z][A-Z0-9_]*(,\s*[A-Z][A-Z0-9_]*)*$/;

export type BriefReasonFormatOpts = {
  mediationReasonKey?: string | null;
  mediationToneKey?: string | null;
};

function mediationLocalized(
  raw: string | null | undefined,
  t: TFunction,
  opts: BriefReasonFormatOpts,
): string {
  const k = `mediation.${opts.mediationReasonKey!}`;
  let out = t(k);
  if (out === k) out = (raw?.trim() || out);
  if (opts.mediationToneKey) {
    const tk = `mediation.${opts.mediationToneKey}`;
    const tone = t(tk);
    if (tone !== tk) out = `${out} · ${tone}`;
  }
  return out;
}

/**
 * Localize brief subtitle lines: mediation keys, legacy "From facts: …", fact-type codes, or raw.
 */
export function formatBriefReasonSummary(
  raw: string | null | undefined,
  t: TFunction,
  opts?: BriefReasonFormatOpts,
): string | undefined {
  if (opts?.mediationReasonKey) {
    return mediationLocalized(raw, t, opts);
  }

  if (raw == null || !String(raw).trim()) return undefined;
  const s = String(raw).trim();
  const legacy = s.match(LEGACY_FROM_FACTS);
  if (legacy?.[1]) {
    return t('obligations.reasonFromFacts', { types: legacy[1].trim() });
  }
  if (FACT_TYPES_ONLY.test(s)) {
    return t('obligations.reasonFromFacts', { types: s });
  }
  return s;
}
