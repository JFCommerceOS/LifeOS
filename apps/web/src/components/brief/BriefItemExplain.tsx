import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError, lifeOsApi } from '../../lib/api';
import { los } from '../../design/tokens';

type Props = {
  itemId: string;
};

export function BriefItemExplain({ itemId }: Props) {
  const { t } = useTranslation();
  const [errorText, setErrorText] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => lifeOsApi.postBriefItemExplain(itemId),
    onMutate: () => setErrorText(null),
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 503) {
        setErrorText(t('brief.explainAssistantUnavailable'));
      } else if (err instanceof Error) {
        setErrorText(err.message);
      } else {
        setErrorText(t('brief.explainAssistantUnavailable'));
      }
    },
  });

  const data = m.data;
  const explanation =
    data && data.enabled ? data.explanation : null;
  const disabledMessage =
    data && !data.enabled ? (data.message ?? t('brief.explainAssistantDisabled')) : null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={`text-left text-sm font-medium ${los.accentLink} disabled:opacity-50`}
        disabled={m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? t('brief.explainAssistantLoading') : t('brief.explainAssistant')}
      </button>

      {errorText ? (
        <div className="space-y-1" role="alert">
          <p className="text-sm text-amber-200/90">{errorText}</p>
          <p className={`text-xs ${los.textMuted}`}>
            <Link className={los.accentLink} to="/settings#settings-local-assistant">
              {t('brief.explainAssistantSettingsLink')}
            </Link>
          </p>
        </div>
      ) : null}

      {disabledMessage ? (
        <div className="space-y-1" role="status">
          <p className={`text-sm ${los.textMuted}`}>{disabledMessage}</p>
          <p className={`text-xs ${los.textMuted}`}>
            <Link className={los.accentLink} to="/settings#settings-local-assistant">
              {t('brief.explainAssistantSettingsLink')}
            </Link>
          </p>
        </div>
      ) : null}

      {explanation ? (
        <div
          className="rounded-lg border border-white/10 bg-[#0F1624]/90 px-3 py-2.5 text-sm leading-relaxed text-slate-200/95"
          role="region"
          aria-live="polite"
        >
          <p className="whitespace-pre-wrap">{explanation}</p>
          <p className={`mt-2 text-xs ${los.textMuted}`}>{t('brief.explainAssistantDisclaimer')}</p>
        </div>
      ) : null}
    </div>
  );
}
