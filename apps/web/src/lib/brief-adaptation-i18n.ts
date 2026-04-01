import type { TFunction } from 'i18next';

/** Mirrors API `ObligationBriefAdaptationPayload` (apps/api adaptation-explanation-service). */
export type ObligationBriefAdaptationPayload = {
  modeSource: 'manual' | 'default';
  effectiveMode: string;
  domain: 'work' | 'study' | 'admin' | 'personal' | 'health_tracking';
  domainWeight: number;
  lowConfidenceRankSoftened: boolean;
  privacySensitivity: string;
};

export function lifeModeLabel(t: TFunction, mode: string): string {
  const key = `brief.lifeMode.${mode}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return mode.replace(/_/g, ' ').toLowerCase();
}

export function formatAdaptationExplanation(t: TFunction, p: ObligationBriefAdaptationPayload): string {
  const modeLabel = lifeModeLabel(t, p.effectiveMode);
  const parts: string[] = [];
  if (p.modeSource === 'manual') {
    parts.push(t('brief.adaptManualFocus', { mode: modeLabel }));
  } else {
    parts.push(t('brief.adaptDefaultMode', { mode: modeLabel }));
  }
  if (p.domainWeight !== 1) {
    const domainLabel = t(`brief.domain.${p.domain}`);
    parts.push(t('brief.adaptDomainWeight', { domain: domainLabel, weight: p.domainWeight }));
  }
  if (p.lowConfidenceRankSoftened) {
    parts.push(t('brief.adaptLowConfidence'));
  }
  parts.push(t('brief.adaptFooter'));
  return parts.join(' ');
}
