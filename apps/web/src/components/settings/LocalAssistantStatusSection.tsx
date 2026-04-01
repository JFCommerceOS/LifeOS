import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../ui/SectionHeader';
import { los } from '../../design/tokens';
import { formatApiError } from '../../lib/format-api-error';
import { lifeOsApi } from '../../lib/api';

function StatusLine({
  label,
  enabled,
  reachable,
}: {
  label: string;
  enabled: boolean;
  reachable: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-200">{label}</span>
      <span className={`rounded px-1.5 py-0.5 text-xs ${enabled ? 'bg-emerald-950/50 text-emerald-200' : 'bg-zinc-800 text-zinc-400'}`}>
        {enabled ? t('settings.localAssistantFlagOn') : t('settings.localAssistantFlagOff')}
      </span>
      <span className={`text-xs ${reachable ? 'text-emerald-300/90' : 'text-amber-200/85'}`}>
        {reachable ? t('settings.localAssistantReachable') : t('settings.localAssistantUnreachable')}
      </span>
    </div>
  );
}

export function LocalAssistantStatusSection() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['health', 'llm'],
    queryFn: () => lifeOsApi.getHealthLlm(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  return (
    <section id="settings-local-assistant" className={`${los.surfaceCard} space-y-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader title={t('settings.localAssistantTitle')} subtitle={t('settings.localAssistantSubtitle')} />
        <button
          type="button"
          className={`text-sm ${los.accentLink}`}
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
        >
          {q.isFetching ? t('common.loading') : t('settings.localAssistantRefresh')}
        </button>
      </div>

      {q.isLoading ? (
        <p className={los.textMuted} role="status">
          {t('common.loading')}
        </p>
      ) : q.isError ? (
        <p className="text-sm text-amber-200/90" role="alert">
          {formatApiError(q.error, t)}
        </p>
      ) : q.data ? (
        <div className="space-y-3">
          <StatusLine
            label={t('settings.localAssistantTier2')}
            enabled={q.data.tier2.enabled}
            reachable={q.data.tier2.ollamaReachable}
          />
          <p className={`text-xs ${los.textMuted}`}>
            {t('settings.localAssistantModel', { model: q.data.tier2.model })}
          </p>
          <StatusLine
            label={t('settings.localAssistantTier1')}
            enabled={q.data.tier1.enabled}
            reachable={q.data.tier1.sidecarReachable}
          />
          <p className={`text-xs ${los.textMuted}`}>{t('settings.localAssistantHint')}</p>
        </div>
      ) : null}
    </section>
  );
}
