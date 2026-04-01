import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../ui/SectionHeader';
import { los } from '../../design/tokens';
import { UI_LOCALE_CODES } from '../../i18n/ui-locales';
import { lifeOsApi } from '../../lib/api';
import { formatApiError } from '../../lib/format-api-error';

type LangRow = {
  languageTag: string;
  displayName: string;
  qualityTier: string;
  uiSupported: boolean;
  typedSupported: boolean;
  sttSupported: boolean;
  ttsSupported: boolean;
  s2sSupported: boolean;
  rolloutState: string;
};

export function LanguageVoiceSection() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [testTtsLine, setTestTtsLine] = useState('Life OS');
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const languages = useQuery({ queryKey: ['languages'], queryFn: () => lifeOsApi.getLanguages() });
  const langPref = useQuery({ queryKey: ['settings-language'], queryFn: () => lifeOsApi.getLanguageSettings() });
  const voiceCap = useQuery({ queryKey: ['voice-capabilities'], queryFn: () => lifeOsApi.getVoiceCapabilities() });

  const patch = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchLanguageSettings(body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['settings-language'] });
      void qc.invalidateQueries({ queryKey: ['voice-capabilities'] });
      const pref = data.preference as { primaryUiLanguage?: string };
      if (pref?.primaryUiLanguage && UI_LOCALE_CODES.has(pref.primaryUiLanguage)) {
        void i18n.changeLanguage(pref.primaryUiLanguage);
      }
    },
  });

  const testStt = useMutation({
    mutationFn: () => lifeOsApi.postVoiceTestStt({}),
    onSuccess: (r) => setTestMsg(`${r.note} (${r.provider})`),
    onError: (e) => setTestMsg(formatApiError(e, t)),
  });

  const testTts = useMutation({
    mutationFn: () => lifeOsApi.postVoiceTestTts({ text: testTtsLine }),
    onSuccess: (r) => setTestMsg(`${r.note} (${r.provider})`),
    onError: (e) => setTestMsg(formatApiError(e, t)),
  });

  const rows = (languages.data?.languages ?? []) as LangRow[];
  const pref = langPref.data?.preference as
    | {
        primaryUiLanguage: string;
        primaryAssistantLanguage: string;
        preferredSttLanguage: string | null;
        preferredTtsLanguage: string | null;
        allowAutoLocaleSwitch: boolean;
      }
    | undefined;

  if (languages.isLoading || langPref.isLoading) {
    return (
      <section className={`${los.surfaceCard} p-5`}>
        <p className={los.textMuted} role="status">
          {t('common.loading')}
        </p>
      </section>
    );
  }

  if (languages.isError || langPref.isError) {
    const err = languages.error ?? langPref.error;
    return (
      <section className={`${los.surfaceCard} p-5`}>
        <p className="text-red-400" role="alert">
          {formatApiError(err, t)}
        </p>
      </section>
    );
  }

  const uiOptions = rows.filter((r) => r.uiSupported);
  const typedOptions = rows.filter((r) => r.typedSupported);
  const sttOpts = rows.filter((r) => r.sttSupported);
  const ttsOpts = rows.filter((r) => r.ttsSupported);

  return (
    <section className={`${los.surfaceCard} space-y-4 p-5`}>
      <SectionHeader title={t('settings.languageVoiceTitle')} subtitle={t('settings.languageVoiceSubtitle')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={`mb-1 block ${los.textMuted}`}>{t('settings.primaryUiLanguage')}</span>
          <select
            className={`${los.input} w-full max-w-md`}
            value={pref?.primaryUiLanguage ?? 'en'}
            disabled={patch.isPending}
            onChange={(e) => patch.mutate({ primaryUiLanguage: e.target.value })}
          >
            {uiOptions.map((r) => (
              <option key={r.languageTag} value={r.languageTag}>
                {r.displayName} ({r.languageTag})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className={`mb-1 block ${los.textMuted}`}>{t('settings.primaryAssistantLanguage')}</span>
          <select
            className={`${los.input} w-full max-w-md`}
            value={pref?.primaryAssistantLanguage ?? 'en'}
            disabled={patch.isPending}
            onChange={(e) => patch.mutate({ primaryAssistantLanguage: e.target.value })}
          >
            {typedOptions.map((r) => (
              <option key={r.languageTag} value={r.languageTag}>
                {r.displayName} ({r.languageTag})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className={`mb-1 block ${los.textMuted}`}>{t('settings.preferredSttLanguage')}</span>
          <select
            className={`${los.input} w-full max-w-md`}
            value={pref?.preferredSttLanguage ?? ''}
            disabled={patch.isPending}
            onChange={(e) =>
              patch.mutate({
                preferredSttLanguage: e.target.value === '' ? null : e.target.value,
              })
            }
          >
            <option value="">{t('settings.defaultFollowsUi')}</option>
            {sttOpts.map((r) => (
              <option key={r.languageTag} value={r.languageTag}>
                {r.displayName} ({r.languageTag})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className={`mb-1 block ${los.textMuted}`}>{t('settings.preferredTtsLanguage')}</span>
          <select
            className={`${los.input} w-full max-w-md`}
            value={pref?.preferredTtsLanguage ?? ''}
            disabled={patch.isPending}
            onChange={(e) =>
              patch.mutate({
                preferredTtsLanguage: e.target.value === '' ? null : e.target.value,
              })
            }
          >
            <option value="">{t('settings.defaultFollowsUi')}</option>
            {ttsOpts.map((r) => (
              <option key={r.languageTag} value={r.languageTag}>
                {r.displayName} ({r.languageTag})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={Boolean(pref?.allowAutoLocaleSwitch)}
          disabled={patch.isPending}
          onChange={(e) => patch.mutate({ allowAutoLocaleSwitch: e.target.checked })}
        />
        {t('settings.allowAutoLocaleSwitch')}
      </label>

      {voiceCap.data ? (
        <div className={`rounded-xl border ${los.borderSubtle} bg-[#0A1018]/80 px-3 py-2 text-xs ${los.textMuted}`}>
          <p className="font-medium text-slate-400">{t('settings.voiceResolution')}</p>
          <p className="mt-1">
            STT: {(voiceCap.data.stt as { provider?: string } | null)?.provider ?? '—'} · TTS:{' '}
            {(voiceCap.data.tts as { provider?: string } | null)?.provider ?? '—'}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed">{voiceCap.data.speechPipelineNote}</p>
        </div>
      ) : voiceCap.isLoading ? (
        <p className={`text-xs ${los.textMuted}`}>{t('common.loading')}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${los.btnSecondary} ${los.focusRing} text-sm`}
          disabled={testStt.isPending}
          onClick={() => {
            setTestMsg(null);
            testStt.mutate();
          }}
        >
          {t('settings.testSttStub')}
        </button>
        <input
          type="text"
          value={testTtsLine}
          onChange={(e) => setTestTtsLine(e.target.value)}
          className={`${los.input} max-w-xs flex-1 text-sm`}
          placeholder={t('settings.testTtsPlaceholder')}
          aria-label={t('settings.testTtsPlaceholder')}
        />
        <button
          type="button"
          className={`${los.btnSecondary} ${los.focusRing} text-sm`}
          disabled={testTts.isPending}
          onClick={() => {
            setTestMsg(null);
            testTts.mutate();
          }}
        >
          {t('settings.testTtsStub')}
        </button>
      </div>
      {testMsg ? <p className={`text-xs ${los.textSecondary}`}>{testMsg}</p> : null}

      <div className="overflow-x-auto pt-2">
        <table className="w-full min-w-[20rem] text-left text-xs text-slate-300">
          <thead>
            <tr className={`border-b ${los.borderSubtle} uppercase tracking-wide text-zinc-500`}>
              <th className="py-2 pr-2">{t('settings.langColLanguage')}</th>
              <th className="py-2 pr-2">{t('settings.langColTier')}</th>
              <th className="py-2 pr-1">UI</th>
              <th className="py-2 pr-1">{t('settings.langColTyped')}</th>
              <th className="py-2 pr-1">STT</th>
              <th className="py-2 pr-1">TTS</th>
              <th className="py-2">{t('settings.langColRollout')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.languageTag} className={`border-b border-white/[0.04]`}>
                <td className="py-1.5 pr-2 font-medium text-slate-200">
                  {r.displayName}{' '}
                  <span className="font-normal text-zinc-500">({r.languageTag})</span>
                </td>
                <td className="py-1.5 pr-2 text-zinc-400">{r.qualityTier}</td>
                <td className="py-1.5">{r.uiSupported ? '✓' : '—'}</td>
                <td className="py-1.5">{r.typedSupported ? '✓' : '—'}</td>
                <td className="py-1.5">{r.sttSupported ? '✓' : '—'}</td>
                <td className="py-1.5">{r.ttsSupported ? '✓' : '—'}</td>
                <td className="py-1.5 text-zinc-500">{r.rolloutState}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={`text-[11px] leading-relaxed ${los.textMuted}`}>{t('settings.languageVoiceFootnote')}</p>
    </section>
  );
}
