import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { LanguageVoiceSection } from '../components/settings/LanguageVoiceSection';
import { LocalAssistantStatusSection } from '../components/settings/LocalAssistantStatusSection';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';
import { formatDateTime } from '../lib/date';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    if (location.hash === '#settings-local-assistant') {
      const el = document.getElementById('settings-local-assistant');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);
  const appSettings = useQuery({ queryKey: ['settings'], queryFn: () => lifeOsApi.getSettings() });
  const privacy = useQuery({ queryKey: ['privacy'], queryFn: () => lifeOsApi.getPrivacy() });
  const connectors = useQuery({ queryKey: ['connectors'], queryFn: () => lifeOsApi.getConnectors() });
  const userState = useQuery({ queryKey: ['user-state'], queryFn: () => lifeOsApi.getUserStateCurrent() });
  const surfacePolicies = useQuery({ queryKey: ['surface-policies'], queryFn: () => lifeOsApi.getSurfacePolicies() });
  const mediationLogs = useQuery({
    queryKey: ['mediation-logs'],
    queryFn: () => lifeOsApi.getMediationLogs(20),
    staleTime: 30_000,
  });

  const patchAppSettings = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchSettings(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['digital-twin'] });
      void qc.invalidateQueries({ queryKey: ['planning-adaptive'] });
      void qc.invalidateQueries({ queryKey: ['ecosystem-manifest'] });
      void qc.invalidateQueries({ queryKey: ['devices'] });
      void qc.invalidateQueries({ queryKey: ['tile-current'] });
      void qc.invalidateQueries({ queryKey: ['tile-modes'] });
    },
  });

  const [name, setName] = useState('Dev connector');
  const [connectorType, setConnectorType] = useState<'STUB' | 'CALENDAR' | 'TASKS' | 'EMAIL_METADATA'>('STUB');

  const patchPrivacy = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchPrivacy(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['privacy'] }),
  });

  const addConnector = useMutation({
    mutationFn: () => lifeOsApi.postConnector({ connectorType, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const syncConnector = useMutation({
    mutationFn: (id: string) => lifeOsApi.postConnectorSync(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const refreshUserState = useMutation({
    mutationFn: () => lifeOsApi.postUserStateRefresh(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-state'] });
    },
  });

  const exportJson = async () => {
    const res = await fetch('/api/v1/privacy/export', { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'life-os-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (privacy.isLoading || connectors.isLoading || appSettings.isLoading) {
    return (
      <p className={los.textMuted} role="status">
        {t('common.loading')}
      </p>
    );
  }

  if (privacy.isError || connectors.isError || appSettings.isError) {
    const err = privacy.error ?? connectors.error ?? appSettings.error;
    return (
      <p className="text-red-400" role="alert">
        {formatApiError(err, t)}
      </p>
    );
  }

  const st = appSettings.data?.settings as
    | {
        patternSignalsOptIn?: boolean;
        lifestyleInsightsOptIn?: boolean;
        predictiveModeOptIn?: boolean;
        deviceSyncOptIn?: boolean;
        ambientTileShowDetail?: boolean;
        voiceCaptureEnabled?: boolean;
        voiceRetainRawAudio?: boolean;
        voiceTranscriptAutosave?: boolean;
        spokenReadoutEnabled?: boolean;
        locationIntelligenceOptIn?: boolean;
        everyoneModeEnabled?: boolean;
        onboardingCompletedAt?: string | null;
      }
    | undefined;

  return (
    <div className={`${los.page} space-y-8`}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">{t('settings.title')}</h1>
        <p className={`mt-2 max-w-xl text-[15px] leading-relaxed ${los.textSecondary}`}>{t('settings.tagline')}</p>
      </header>

      <LanguageVoiceSection />

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title="Everyone Mode" subtitle="Simple default UI for daily capture and follow-through." />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={st?.everyoneModeEnabled !== false}
            onChange={(e) => patchAppSettings.mutate({ everyoneModeEnabled: e.target.checked })}
          />
          Keep advanced modules hidden by default
        </label>
        <p className={`text-xs ${los.textMuted}`}>
          Onboarding status:{' '}
          {st?.onboardingCompletedAt
            ? formatDateTime(st.onboardingCompletedAt, i18n.language)
            : 'not completed'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/welcome" className={los.accentLink}>
            Open onboarding
          </Link>
          <button
            type="button"
            className={`${los.btnSecondary} ${los.focusRing}`}
            onClick={() => patchAppSettings.mutate({ onboardingCompletedAt: new Date().toISOString() })}
          >
            Mark onboarding complete
          </button>
        </div>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.voiceCaptureSection')} subtitle={t('settings.voiceCaptureSubtitle')} />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={st?.voiceCaptureEnabled !== false}
            onChange={(e) => patchAppSettings.mutate({ voiceCaptureEnabled: e.target.checked })}
          />
          {t('settings.voiceCaptureEnabled')}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={st?.voiceRetainRawAudio !== false}
            onChange={(e) => patchAppSettings.mutate({ voiceRetainRawAudio: e.target.checked })}
          />
          {t('settings.voiceRetainRawAudio')}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={st?.voiceTranscriptAutosave !== false}
            onChange={(e) => patchAppSettings.mutate({ voiceTranscriptAutosave: e.target.checked })}
          />
          {t('settings.voiceTranscriptAutosave')}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.spokenReadoutEnabled)}
            onChange={(e) => patchAppSettings.mutate({ spokenReadoutEnabled: e.target.checked })}
          />
          {t('settings.spokenReadoutEnabled')}
        </label>
      </section>

      <LocalAssistantStatusSection />

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.devicesEcosystem')} subtitle={t('settings.devicesSubtitle')} />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.deviceSyncOptIn)}
            onChange={(e) => patchAppSettings.mutate({ deviceSyncOptIn: e.target.checked })}
          />
          {t('settings.deviceSyncLabel')}
        </label>
        <p className={`text-xs ${los.textMuted}`}>
          <Trans
            i18nKey="settings.deviceSyncHint"
            components={{
              ecosystemLink: (
                <a className={los.accentLink} href="/ecosystem" aria-label={t('nav.ecosystem')} />
              ),
            }}
          />
        </p>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.ambientTile')} />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.ambientTileShowDetail)}
            onChange={(e) => patchAppSettings.mutate({ ambientTileShowDetail: e.target.checked })}
          />
          {t('settings.ambientTileLabel')}
        </label>
        <p className={`text-xs ${los.textMuted}`}>
          <Trans
            i18nKey="settings.ambientTileHint"
            components={{
              tileLink: <a className={los.accentLink} href="/tile" aria-label={t('nav.tile')} />,
              mono: <code className="text-slate-400" />,
            }}
          />
        </p>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.assistant')} subtitle={t('settings.assistantSubtitle')} />
        {userState.isLoading || surfacePolicies.isLoading ? (
          <p className={los.textMuted} role="status">
            {t('common.loading')}
          </p>
        ) : userState.isError || surfacePolicies.isError ? (
          <p className="text-red-400" role="alert">
            {formatApiError(userState.error ?? surfacePolicies.error, t)}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1 text-sm">
                {userState.data?.snapshot ? (
                  <>
                    <p className="text-slate-200">
                      <span className="text-zinc-500">{t('settings.assistantState')}: </span>
                      <span className="font-medium text-slate-100">
                        {(userState.data.snapshot as { stateType?: string }).stateType ?? '—'}
                      </span>
                      <span className="text-zinc-500"> · </span>
                      <span className="text-zinc-500">{t('settings.assistantConfidence')}: </span>
                      <span>
                        {Math.round(
                          ((userState.data.snapshot as { confidence?: number }).confidence ?? 0) * 100,
                        )}
                        %
                      </span>
                    </p>
                    <p className={`text-xs ${los.textMuted}`}>
                      {(userState.data.snapshot as { sourceSummary?: string | null }).sourceSummary ?? ''}
                    </p>
                    <p className={`text-xs ${los.textMuted}`}>
                      {t('settings.assistantDetected')}:{' '}
                      {formatDateTime(
                        (userState.data.snapshot as { detectedAt?: string }).detectedAt ?? null,
                        i18n.language,
                      )}
                    </p>
                  </>
                ) : (
                  <p className={`text-sm ${los.textMuted}`}>{t('settings.assistantNoSnapshot')}</p>
                )}
              </div>
              <button
                type="button"
                className={`${los.btnSecondary} ${los.focusRing}`}
                disabled={refreshUserState.isPending}
                onClick={() => refreshUserState.mutate()}
              >
                {t('settings.assistantRefresh')}
              </button>
            </div>
            <div className="overflow-x-auto pt-2">
              <table className="w-full min-w-[18rem] text-left text-sm text-slate-200">
                <thead>
                  <tr className={`border-b ${los.borderSubtle} text-xs uppercase tracking-wide text-zinc-500`}>
                    <th className="py-2 pr-3">{t('settings.assistantSurface')}</th>
                    <th className="py-2 pr-3">{t('settings.assistantUrgency')}</th>
                    <th className="py-2">{t('settings.assistantInterruptions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    surfacePolicies.data?.policies as
                      | { id: string; surfaceType: string; urgencyThreshold: number; interruptionLimit: number }[]
                      | undefined
                  )?.map((p) => (
                    <tr key={p.id} className={`border-b ${los.borderSubtle}`}>
                      <td className="py-2 pr-3 font-medium capitalize">{p.surfaceType}</td>
                      <td className="py-2 pr-3">{p.urgencyThreshold.toFixed(2)}</td>
                      <td className="py-2">{p.interruptionLimit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`space-y-2 border-t ${los.borderSubtle} pt-4`}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t('settings.mediationLogTitle')}
              </h3>
              <p className={`text-xs ${los.textMuted}`}>{t('settings.mediationLogSubtitle')}</p>
              {mediationLogs.isLoading ? (
                <p className={`text-sm ${los.textMuted}`} role="status">
                  {t('common.loading')}
                </p>
              ) : mediationLogs.isError ? (
                <p className="text-sm text-red-400" role="alert">
                  {formatApiError(mediationLogs.error, t)}
                </p>
              ) : ((mediationLogs.data?.logs as unknown[]) ?? []).length === 0 ? (
                <p className={`text-sm ${los.textMuted}`}>{t('settings.mediationLogEmpty')}</p>
              ) : (
                <div className="max-h-48 overflow-x-auto overflow-y-auto rounded-md border border-white/10">
                  <table className="w-full min-w-[22rem] text-left text-sm text-slate-200">
                    <thead>
                      <tr className={`sticky top-0 bg-[#0F1624] text-xs uppercase tracking-wide text-zinc-500`}>
                        <th className="px-2 py-2">{t('settings.mediationLogWhen')}</th>
                        <th className="px-2 py-2">{t('settings.mediationLogDecision')}</th>
                        <th className="px-2 py-2">{t('settings.mediationLogSurface')}</th>
                        <th className="px-2 py-2">{t('settings.mediationLogWhy')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        (mediationLogs.data?.logs as Array<{
                          id: string;
                          mediationDecision: string;
                          targetSurface: string;
                          reasonSummary: string | null;
                          createdAt: string;
                        }>) ?? []
                      ).map((row) => (
                        <tr key={row.id} className={`border-t ${los.borderSubtle}`}>
                          <td className="whitespace-nowrap px-2 py-1.5 text-xs text-zinc-400">
                            {formatDateTime(row.createdAt, i18n.language)}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-xs">{row.mediationDecision}</td>
                          <td className="px-2 py-1.5 font-mono text-xs">{row.targetSurface}</td>
                          <td className="px-2 py-1.5 text-xs text-slate-300">
                            {row.reasonSummary ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
        <p className={`text-xs ${los.textMuted}`}>
          {t('settings.capabilityCenterLink')}{' '}
          <Link className={los.accentLink} to="/capabilities">
            {t('settings.capabilityCenterCta')}
          </Link>{' '}
          ·{' '}
          <Link className={los.accentLink} to="/domains">
            {t('settings.domainsCta')}
          </Link>
        </p>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.copilot')} subtitle={t('settings.copilotSubtitle')} />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.predictiveModeOptIn)}
            onChange={(e) => patchAppSettings.mutate({ predictiveModeOptIn: e.target.checked })}
          />
          {t('settings.predictiveLabel')}
        </label>
        <p className={`text-xs ${los.textMuted}`}>
          <Trans
            i18nKey="settings.copilotHint"
            components={{
              twinLink: <a className={los.accentLink} href="/twin" aria-label={t('nav.copilot')} />,
            }}
          />
        </p>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.lifestyle')} subtitle={t('settings.lifestyleSubtitle')} />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.lifestyleInsightsOptIn)}
            onChange={(e) => patchAppSettings.mutate({ lifestyleInsightsOptIn: e.target.checked })}
          />
          {t('settings.lifestyleLabel')}
        </label>
        <p className={`text-xs ${los.textMuted}`}>
          <Trans
            i18nKey="settings.lifestyleHint"
            components={{
              lifeLink: <a className={los.accentLink} href="/life" aria-label={t('nav.lifeFlow')} />,
            }}
          />
        </p>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.patterns')} subtitle={t('settings.patternsSubtitle')} />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.patternSignalsOptIn)}
            onChange={(e) => patchAppSettings.mutate({ patternSignalsOptIn: e.target.checked })}
          />
          {t('settings.patternsLabel')}
        </label>
        <p className={`text-xs ${los.textMuted}`}>
          <Trans
            i18nKey="settings.patternsHint"
            components={{
              patternsLink: <a className={los.accentLink} href="/patterns" aria-label={t('nav.patterns')} />,
            }}
          />
        </p>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.privacy')} />
        <p className={`text-xs ${los.textMuted}`}>
          <Link to="/privacy" className={`${los.accentLink}`}>
            Privacy Center
          </Link>{' '}
          — storage inventory, retention policies, export jobs, and action log.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(privacy.data?.privacyStrictMode)}
            onChange={(e) => patchPrivacy.mutate({ privacyStrictMode: e.target.checked })}
          />
          {t('settings.strictLabel')}
        </label>
        <p className={`text-xs ${los.textMuted}`}>
          {t('settings.retention', { days: String(privacy.data?.retentionDays ?? '—') })}
        </p>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.connectors')} />
        <p className={`text-xs ${los.textMuted}`}>
          <Link to="/connectors" className={`${los.accentLink}`}>
            Open Connectors hub
          </Link>{' '}
          for catalog, permissions, sync runs, and purge.
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            className={`${los.input} max-w-[10rem]`}
            value={connectorType}
            onChange={(e) =>
              setConnectorType(e.target.value as 'STUB' | 'CALENDAR' | 'TASKS' | 'EMAIL_METADATA')
            }
            aria-label={t('settings.typePlaceholder')}
          >
            <option value="STUB">STUB</option>
            <option value="CALENDAR">CALENDAR</option>
            <option value="TASKS">TASKS</option>
            <option value="EMAIL_METADATA">EMAIL_METADATA</option>
          </select>
          <input
            className={`${los.input} max-w-[12rem]`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.namePlaceholder')}
          />
          <button
            type="button"
            className={`${los.btnSecondary} ${los.focusRing}`}
            onClick={() => addConnector.mutate()}
          >
            {t('settings.add')}
          </button>
        </div>
        <ul className="space-y-2">
          {(connectors.data?.connectors as { id: string; name: string; type: string; connectorType?: string }[] ?? []).map((c) => (
            <li
              key={c.id}
              className={`flex items-center justify-between rounded-xl border ${los.borderSubtle} bg-[#0F1624]/50 px-3 py-2 text-sm`}
            >
              <span>
                {c.name}{' '}
                <span className="text-zinc-500">({c.connectorType ?? c.type})</span>
              </span>
              <button
                type="button"
                className={`${los.accentLink} cursor-pointer bg-transparent text-sm`}
                onClick={() => syncConnector.mutate(c.id)}
              >
                {t('settings.sync')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${los.surfaceCard} space-y-3 p-5`}>
        <SectionHeader title={t('settings.exportSection')} />
        <p className={`text-xs ${los.textMuted}`}>
          <Trans i18nKey="settings.exportHint" components={{ mono: <code className="text-cyan-400" /> }} />
        </p>
        <button
          type="button"
          className={`${los.btnSecondary} ${los.focusRing}`}
          onClick={() => exportJson().catch(console.error)}
        >
          {t('settings.downloadExport')}
        </button>
      </section>
    </div>
  );
}
