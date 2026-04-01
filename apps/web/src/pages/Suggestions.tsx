import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';
import { los } from '../design/tokens';

type Suggestion = {
  id: string;
  title: string;
  reason: string;
  confidence: number;
  state: string;
};

export default function Suggestions() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => lifeOsApi.getSuggestions(1),
  });

  const act = useMutation({
    mutationFn: (args: { id: string; action: 'dismiss' | 'snooze' | 'false_positive' }) =>
      lifeOsApi.postSuggestionAction(args.id, { action: args.action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suggestions'] });
      void qc.invalidateQueries({ queryKey: ['brief', 'latest'] });
    },
  });

  if (list.isLoading) {
    return (
      <p className={los.textMuted} role="status">
        {t('common.loading')}
      </p>
    );
  }
  if (list.isError) {
    return (
      <p className="text-red-400" role="alert">
        {formatApiError(list.error, t)}
      </p>
    );
  }

  const rows = (list.data?.data ?? []) as Suggestion[];

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-50">{t('suggestions.title')}</h1>
      <p className={`text-sm ${los.textMuted}`}>{t('suggestions.intro')}</p>
      <ul className="space-y-2">
        {rows.map((s) => (
          <li
            key={s.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 space-y-2"
          >
            <div>
              <div className="font-medium text-slate-100">{s.title}</div>
              <div className={`text-sm ${los.textSecondary}`}>{s.reason}</div>
              <div className={`text-xs ${los.textMuted}`}>
                {t('suggestions.confidence', { pct: (s.confidence * 100).toFixed(0) })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-cyan-800/60 px-2 py-1 text-xs text-zinc-100 hover:bg-cyan-600/60"
                onClick={() => act.mutate({ id: s.id, action: 'dismiss' })}
              >
                {t('suggestions.dismiss')}
              </button>
              <button
                type="button"
                className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                onClick={() => act.mutate({ id: s.id, action: 'snooze' })}
              >
                {t('suggestions.snooze')}
              </button>
              <button
                type="button"
                className="rounded border border-amber-900/50 px-2 py-1 text-xs text-amber-200/90 hover:bg-zinc-800"
                onClick={() => act.mutate({ id: s.id, action: 'false_positive' })}
              >
                {t('suggestions.falsePositive')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className={los.textMuted}>{t('suggestions.empty')}</p> : null}
    </div>
  );
}
