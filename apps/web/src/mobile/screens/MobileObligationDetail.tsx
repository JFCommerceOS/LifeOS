import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { los } from '../../design/tokens';
import { formatApiError } from '../../lib/format-api-error';
import { lifeOsApi } from '../../lib/api';

export default function MobileObligationDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['obligation', id],
    queryFn: () => lifeOsApi.getObligation(id!),
    enabled: Boolean(id),
  });

  const mu = useMutation({
    mutationFn: (action: 'confirm' | 'dismiss' | 'resolve') =>
      lifeOsApi.patchObligation(id!, { action }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['obligation', id] });
      await qc.invalidateQueries({ queryKey: ['mobile-brief-today'] });
    },
  });

  if (!id) return null;
  if (q.isLoading) return <p className={los.textMuted}>{t('common.loading')}</p>;
  if (q.isError) return <p className="text-rose-300">{formatApiError(q.error, t)}</p>;

  const ob = q.data?.obligation as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <Link to="/m" className={`text-sm ${los.accentLink}`}>
        ← {t('mobile.briefTitle')}
      </Link>
      <div className={`rounded-xl border border-white/10 bg-white/[0.04] p-4`}>
        <h2 className={`text-lg font-semibold ${los.textPrimary}`}>{String(ob.title)}</h2>
        {ob.description ? (
          <p className={`mt-2 text-sm ${los.textSecondary}`}>{String(ob.description)}</p>
        ) : null}
        <p className={`mt-2 text-xs ${los.textMuted}`}>Status: {String(ob.status)}</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={mu.isPending}
          className={`rounded-lg border border-white/15 py-3 text-sm ${los.focusRing}`}
          onClick={() => mu.mutate('confirm')}
        >
          {t('mobile.confirm')}
        </button>
        <button
          type="button"
          disabled={mu.isPending}
          className={`rounded-lg border border-white/15 py-3 text-sm ${los.focusRing}`}
          onClick={() => mu.mutate('dismiss')}
        >
          {t('mobile.dismiss')}
        </button>
        <button
          type="button"
          disabled={mu.isPending}
          className={`rounded-lg border border-emerald-400/30 py-3 text-sm text-emerald-200 ${los.focusRing}`}
          onClick={() => mu.mutate('resolve')}
        >
          {t('mobile.resolve')}
        </button>
      </div>
      {mu.isError ? <p className="text-rose-300">{formatApiError(mu.error, t)}</p> : null}

      <Link to="/obligations" className={`block text-center text-xs ${los.accentLink}`}>
        {t('nav.obligations')} (desktop)
      </Link>
    </div>
  );
}
