import type { UprModifierContext } from './priority-adaptation-service.js';
import { DEFAULT_DOMAIN_WEIGHTS, classifyObligationDomain, modeDomainAffinity } from '../lib/upr-domain-weights.js';

/** Structured adaptation for the daily brief; localized on the client. */
export type ObligationBriefAdaptationPayload = {
  modeSource: 'manual' | 'default';
  effectiveMode: string;
  domain: keyof typeof DEFAULT_DOMAIN_WEIGHTS;
  domainWeight: number;
  lowConfidenceRankSoftened: boolean;
  privacySensitivity: string;
};

export function buildObligationBriefAdaptationPayload(
  title: string,
  ctx: UprModifierContext,
): ObligationBriefAdaptationPayload {
  const domain = classifyObligationDomain({ title, obligationType: null });
  const w = ctx.domainWeights[domain] ?? 1;
  const lowConfidenceRankSoftened =
    ctx.lowConfidenceRankMultiplier < 0.999 && ctx.privacySensitivity !== 'STRICT';
  return {
    modeSource: ctx.modeSource,
    effectiveMode: ctx.effectiveMode,
    domain,
    domainWeight: w,
    lowConfidenceRankSoftened,
    privacySensitivity: ctx.privacySensitivity,
  };
}

export function buildSuggestionAdaptationHints(
  title: string,
  confidence: number,
  ctx: UprModifierContext,
): { modifier: number; hints: string[] } {
  const domain = classifyObligationDomain({ title, obligationType: null });
  const dw = ctx.domainWeights[domain] ?? 1;
  const mm = modeDomainAffinity(ctx.effectiveMode, domain);
  let mod = dw * mm;
  if (confidence < 0.45) mod *= ctx.lowConfidenceRankMultiplier;
  const hints: string[] = [];
  if (mm > 1) hints.push('Active focus mode gives a small boost to items that match that context.');
  if (dw !== 1) hints.push(`Domain weight ${domain}: ${dw}×`);
  if (confidence < 0.45 && ctx.lowConfidenceRankMultiplier < 1) hints.push('Low-confidence ranking softened from your dismiss pattern.');
  return { modifier: Math.round(mod * 1000) / 1000, hints };
}
