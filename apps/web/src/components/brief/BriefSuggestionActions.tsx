import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { los } from '../../design/tokens';
import { lifeOsApi } from '../../lib/api';

type Action = 'accept' | 'dismiss' | 'snooze' | 'false_positive' | 'resolve';

export function BriefSuggestionActions({
  suggestionId,
  surface = 'DAILY_BRIEF',
}: {
  suggestionId: string;
  surface?: 'DAILY_BRIEF' | 'OBLIGATIONS' | 'EVENT_DETAIL' | 'MEMORY_INSPECTOR';
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (action: Action) =>
      lifeOsApi.postSuggestionAction(suggestionId, {
        action,
        surface,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['brief'] });
      void qc.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={mut.isPending}
        className={`${los.btnCompactPrimary} ${los.focusRing}`}
        onClick={() => mut.mutate('accept')}
        title={t('brief.actionConfirm')}
      >
        {t('brief.actionConfirm')}
      </button>
      <button
        type="button"
        disabled={mut.isPending}
        className={`${los.btnCompactSecondary} ${los.focusRing}`}
        onClick={() => mut.mutate('dismiss')}
      >
        {t('brief.actionDismiss')}
      </button>
      <button
        type="button"
        disabled={mut.isPending}
        className="rounded-xl border border-emerald-900/40 bg-emerald-950/25 px-2.5 py-1.5 text-xs text-emerald-200/90 hover:bg-emerald-950/40 disabled:opacity-50"
        onClick={() => mut.mutate('resolve')}
        title={t('brief.resolveLinkedTitle')}
      >
        {t('brief.actionResolve')}
      </button>
      <button
        type="button"
        disabled={mut.isPending}
        className={`${los.btnCompactSecondary} ${los.focusRing}`}
        onClick={() => mut.mutate('snooze')}
      >
        {t('brief.snooze24h')}
      </button>
      <button
        type="button"
        disabled={mut.isPending}
        className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-2.5 py-1.5 text-xs text-amber-200/90 hover:bg-amber-950/35 disabled:opacity-50"
        onClick={() => mut.mutate('false_positive')}
      >
        {t('brief.notUseful')}
      </button>
    </div>
  );
}
