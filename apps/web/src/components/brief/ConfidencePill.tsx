/** Soft confidence / evidence indicator for brief and cards (Sprint 04). */

import { useTranslation } from 'react-i18next';

export function ConfidencePill({
  confidence,
  evidenceCount,
}: {
  confidence?: number | null;
  evidenceCount?: number | null;
}) {
  const { t } = useTranslation();
  const c = confidence != null ? Math.round(confidence * 100) : null;
  const ev = evidenceCount != null && evidenceCount > 0;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
      {c != null ? (
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-slate-300">
          {t('brief.confidenceApprox', { pct: c })}
        </span>
      ) : null}
      {ev ? (
        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 text-cyan-200/85">
          {t('brief.evidenceCount', { count: evidenceCount ?? 0 })}
        </span>
      ) : (
        <span className="text-slate-500">{t('brief.noEvidenceLinked')}</span>
      )}
    </div>
  );
}
