import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

type CapRow = {
  capabilityKey: string;
  runtimeState: string;
  activationLevel: number;
  trustScore: number;
  sensitivityClass: number;
  explanationTemplate?: string;
  catalog?: {
    purposeLabel: string;
    dataSourcesRequired: string[];
    permissionScopeRequired: string[];
  } | null;
};

export default function Capabilities() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const caps = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => lifeOsApi.getCapabilities(),
  });
  const hints = useQuery({
    queryKey: ['capabilities-onboarding'],
    queryFn: () => lifeOsApi.getCapabilityOnboardingHints(),
  });

  const patchState = useMutation({
    mutationFn: (args: { capabilityKey: string; runtimeState: string }) =>
      lifeOsApi.patchCapabilityState(args.capabilityKey, { runtimeState: args.runtimeState }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['capabilities'] });
    },
  });

  if (caps.isLoading || hints.isLoading) {
    return (
      <p className={los.textMuted} role="status">
        {t('common.loading')}
      </p>
    );
  }

  if (caps.isError || hints.isError) {
    return (
      <p className="text-red-400" role="alert">
        {formatApiError(caps.error ?? hints.error, t)}
      </p>
    );
  }

  const rows = (caps.data?.capabilities ?? []) as CapRow[];
  const hintList = hints.data?.hints ?? [];

  return (
    <div className={`${los.page} space-y-8`}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">{t('capabilities.title')}</h1>
        <p className={`mt-2 max-w-xl text-[15px] leading-relaxed ${los.textSecondary}`}>{t('capabilities.tagline')}</p>
      </header>

      {hintList.length > 0 && (
        <section className={`${los.surfaceCard} space-y-3 p-5`}>
          <SectionHeader title={t('capabilities.hintsTitle')} subtitle={t('capabilities.hintsSubtitle')} />
          <ul className="space-y-3 text-sm text-slate-200">
            {hintList.map((h) => (
              <li key={h.capabilityKey} className={`rounded-lg border ${los.borderSubtle} bg-[#0F1624]/40 px-3 py-2`}>
                <p className="font-medium text-slate-100">{h.purposeLabel}</p>
                <p className={`mt-1 text-xs ${los.textMuted}`}>{h.purposeCopy}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('capabilities.registryTitle')} subtitle={t('capabilities.registrySubtitle')} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm text-slate-200">
            <thead>
              <tr className={`border-b ${los.borderSubtle} text-xs uppercase tracking-wide text-zinc-500`}>
                <th className="py-2 pr-3">{t('capabilities.colCapability')}</th>
                <th className="py-2 pr-3">{t('capabilities.colState')}</th>
                <th className="py-2 pr-3">{t('capabilities.colTrust')}</th>
                <th className="py-2 pr-3">{t('capabilities.colSensitivity')}</th>
                <th className="py-2">{t('capabilities.colAdjust')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.capabilityKey} className={`border-b ${los.borderSubtle}`}>
                  <td className="py-2 pr-3 align-top">
                    <div className="font-mono text-xs text-cyan-200/90">{r.capabilityKey}</div>
                    <div className={`mt-1 text-xs ${los.textMuted}`}>{r.catalog?.purposeLabel ?? '—'}</div>
                  </td>
                  <td className="py-2 pr-3 align-top capitalize">{r.runtimeState.split('_').join(' ')}</td>
                  <td className="py-2 pr-3 align-top">{Math.round(r.trustScore * 100)}%</td>
                  <td className="py-2 pr-3 align-top">{r.sensitivityClass}</td>
                  <td className="py-2 align-top">
                    <label className="sr-only" htmlFor={`state-${r.capabilityKey}`}>
                      {t('capabilities.colAdjust')}
                    </label>
                    <select
                      id={`state-${r.capabilityKey}`}
                      className={`${los.input} max-w-[11rem] text-xs`}
                      value={r.runtimeState}
                      disabled={patchState.isPending}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === r.runtimeState) return;
                        patchState.mutate({ capabilityKey: r.capabilityKey, runtimeState: v });
                      }}
                    >
                      <option value="not_enabled">{t('capabilities.stateNotEnabled')}</option>
                      <option value="passive">{t('capabilities.statePassive')}</option>
                      <option value="active">{t('capabilities.stateActive')}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`text-xs ${los.textMuted}`}>{t('capabilities.footerNote')}</p>
      </section>
    </div>
  );
}
