import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

type ProfileRow = {
  catalog: {
    domainKey: string;
    displayName: string;
    description: string;
    category: string;
  };
  profile: {
    runtimeState: string;
    activationStrength: string;
    confidence: number;
  } | null;
  metrics: { trustScore: number } | null;
};

export default function Domains() {
  const { t } = useTranslation();
  const profile = useQuery({
    queryKey: ['domains-profile'],
    queryFn: () => lifeOsApi.getDomainsProfile(),
  });
  const ui = useQuery({
    queryKey: ['domains-ui'],
    queryFn: () => lifeOsApi.getDomainAdaptationUi(),
  });

  if (profile.isLoading || ui.isLoading) {
    return (
      <p className={los.textMuted} role="status">
        {t('common.loading')}
      </p>
    );
  }

  if (profile.isError || ui.isError) {
    return (
      <p className="text-red-400" role="alert">
        {formatApiError(profile.error ?? ui.error, t)}
      </p>
    );
  }

  const rows = (profile.data?.profile ?? []) as ProfileRow[];
  const uiHints = ui.data?.ui as { emphasis?: string[]; contentDensity?: string; simplerExplanations?: boolean } | undefined;

  return (
    <div className={`${los.page} space-y-8`}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">{t('domains.title')}</h1>
        <p className={`mt-2 max-w-xl text-[15px] leading-relaxed ${los.textSecondary}`}>{t('domains.tagline')}</p>
      </header>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('domains.uiTitle')} subtitle={t('domains.uiSubtitle')} />
        <ul className={`list-inside list-disc text-sm ${los.textMuted}`}>
          <li>
            {t('domains.uiDensity')}: <span className="text-slate-200">{uiHints?.contentDensity ?? '—'}</span>
          </li>
          <li>
            {t('domains.uiEmphasis')}:{' '}
            <span className="text-slate-200">{(uiHints?.emphasis ?? []).join(', ') || '—'}</span>
          </li>
          <li>
            {t('domains.uiSimpler')}:{' '}
            <span className="text-slate-200">{uiHints?.simplerExplanations ? t('common.yes') : t('common.no')}</span>
          </li>
        </ul>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('domains.registryTitle')} subtitle={t('domains.registrySubtitle')} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm text-slate-200">
            <thead>
              <tr className={`border-b ${los.borderSubtle} text-xs uppercase tracking-wide text-zinc-500`}>
                <th className="py-2 pr-3">{t('domains.colDomain')}</th>
                <th className="py-2 pr-3">{t('domains.colState')}</th>
                <th className="py-2 pr-3">{t('domains.colStrength')}</th>
                <th className="py-2 pr-3">{t('domains.colTrust')}</th>
                <th className="py-2">{t('domains.colDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.catalog.domainKey} className={`border-b ${los.borderSubtle}`}>
                  <td className="py-2 pr-3 align-top">
                    <div className="font-medium text-slate-100">{r.catalog.displayName}</div>
                    <div className={`font-mono text-xs ${los.textMuted}`}>{r.catalog.domainKey}</div>
                  </td>
                  <td className="py-2 pr-3 align-top capitalize">{r.profile?.runtimeState?.split('_').join(' ') ?? '—'}</td>
                  <td className="py-2 pr-3 align-top capitalize">{r.profile?.activationStrength ?? '—'}</td>
                  <td className="py-2 pr-3 align-top">
                    {r.metrics != null ? `${Math.round(r.metrics.trustScore * 100)}%` : '—'}
                  </td>
                  <td className="py-2 align-top">
                    <Link className={los.accentLink} to={`/domains/${encodeURIComponent(r.catalog.domainKey)}`}>
                      {t('domains.openDetail')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`text-xs ${los.textMuted}`}>{t('domains.footerUx')}</p>
      </section>
    </div>
  );
}
