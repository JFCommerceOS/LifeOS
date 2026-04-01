import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

export default function DomainDetail() {
  const { domainKey = '' } = useParams<{ domainKey: string }>();
  const decoded = decodeURIComponent(domainKey);
  const { t } = useTranslation();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['domain-detail', decoded],
    queryFn: () => lifeOsApi.getDomainProfileDetail(decoded),
    enabled: Boolean(decoded),
  });

  const patch = useMutation({
    mutationFn: (body: { runtimeState?: string; activationStrength?: string }) =>
      lifeOsApi.patchDomainProfile(decoded, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['domain-detail', decoded] });
      void qc.invalidateQueries({ queryKey: ['domains-profile'] });
      void qc.invalidateQueries({ queryKey: ['domains-ui'] });
    },
  });

  if (!decoded) {
    return <p className={los.textMuted}>{t('domains.missingKey')}</p>;
  }

  if (detail.isLoading) {
    return (
      <p className={los.textMuted} role="status">
        {t('common.loading')}
      </p>
    );
  }

  if (detail.isError) {
    return (
      <p className="text-red-400" role="alert">
        {formatApiError(detail.error, t)}
      </p>
    );
  }

  const d = detail.data as {
    catalog: {
      displayName: string;
      domainKey: string;
      description: string;
      allowedBehaviorsJson: string;
      blockedBehaviorsJson: string;
    };
    profile: { runtimeState: string; activationStrength: string; confidence: number } | null;
    metrics: { trustScore: number } | null;
    behaviorPolicy: { explanationTemplate: string; maxAssertivenessLevel: number } | null;
  };

  return (
    <div className={`${los.page} space-y-8`}>
      <header>
        <p className="mb-2">
          <Link to="/domains" className={`text-sm ${los.accentLink}`}>
            ← {t('domains.backToList')}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">{d.catalog.displayName}</h1>
        <p className={`mt-2 max-w-xl text-[15px] leading-relaxed ${los.textSecondary}`}>{d.catalog.description}</p>
      </header>

      <section className={`${los.surfaceCard} space-y-4 p-5`}>
        <SectionHeader title={t('domains.detail.adjustTitle')} subtitle={t('domains.detail.adjustSubtitle')} />
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">{t('domains.colState')}</span>
            <select
              className={`${los.input} max-w-[14rem]`}
              disabled={patch.isPending}
              value={d.profile?.runtimeState ?? 'not_active'}
              onChange={(e) => patch.mutate({ runtimeState: e.target.value })}
            >
              <option value="not_active">{t('domains.stateNotActive')}</option>
              <option value="passive">{t('domains.statePassive')}</option>
              <option value="active">{t('domains.stateActive')}</option>
              <option value="restricted">{t('domains.stateRestricted')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">{t('domains.colStrength')}</span>
            <select
              className={`${los.input} max-w-[14rem]`}
              disabled={patch.isPending}
              value={d.profile?.activationStrength ?? 'medium'}
              onChange={(e) => patch.mutate({ activationStrength: e.target.value })}
            >
              <option value="low">{t('domains.strengthLow')}</option>
              <option value="medium">{t('domains.strengthMedium')}</option>
              <option value="high">{t('domains.strengthHigh')}</option>
            </select>
          </label>
        </div>
        <p className={`text-xs ${los.textMuted}`}>
          {t('domains.detail.trustLine', {
            pct: d.metrics != null ? String(Math.round(d.metrics.trustScore * 100)) : '—',
          })}
        </p>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('domains.detail.boundariesTitle')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-emerald-200/90">{t('domains.detail.allowed')}</h3>
            <pre className={`mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border ${los.borderSubtle} bg-[#0F1624]/50 p-3 font-mono text-xs text-slate-300`}>
              {d.catalog.allowedBehaviorsJson}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium text-amber-200/90">{t('domains.detail.blocked')}</h3>
            <pre className={`mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border ${los.borderSubtle} bg-[#0F1624]/50 p-3 font-mono text-xs text-slate-300`}>
              {d.catalog.blockedBehaviorsJson}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
