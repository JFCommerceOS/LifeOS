import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { los } from '../../design/tokens';
import { lifeOsApi } from '../../lib/api';

export function BriefObligationActions({
  obligationId,
  surface = 'DAILY_BRIEF',
}: {
  obligationId: string;
  surface?: 'DAILY_BRIEF' | 'OBLIGATIONS' | 'EVENT_DETAIL' | 'MEMORY_INSPECTOR';
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (action: 'confirm' | 'dismiss' | 'resolve') =>
      lifeOsApi.patchObligation(obligationId, { action, note: undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['brief'] });
      void qc.invalidateQueries({ queryKey: ['obligations'] });
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={mut.isPending}
        className={`${los.btnCompactPrimary} ${los.focusRing}`}
        onClick={() => mut.mutate('confirm')}
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
      >
        {t('brief.actionResolve')}
      </button>
      <span className="sr-only">Surface: {surface}</span>
    </div>
  );
}
