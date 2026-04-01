import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { los } from '../../design/tokens';
import { formatApiError } from '../../lib/format-api-error';
import { lifeOsApi } from '../../lib/api';

export default function NotificationDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['notification', id],
    queryFn: () => lifeOsApi.getNotification(id!),
    enabled: Boolean(id),
  });

  const act = useMutation({
    mutationFn: (body: { action: string; snoozeMinutes?: number }) =>
      lifeOsApi.postNotificationAction(id!, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications-inbox'] });
      navigate('/m/inbox');
    },
  });

  if (!id) return null;
  if (q.isLoading) return <p className={los.textMuted}>{t('common.loading')}</p>;
  if (q.isError) return <p className="text-rose-300">{formatApiError(q.error, t)}</p>;

  const n = q.data?.notification as Record<string, unknown> | undefined;
  if (!n) return <p className={los.textMuted}>Not found</p>;
  const linkedType = String(n.linkedEntityType ?? '');
  const linkedId = String(n.linkedEntityId ?? '');

  return (
    <div className="space-y-4">
      <Link to="/m/inbox" className={`text-sm ${los.accentLink}`}>
        ← {t('mobile.inboxTitle')}
      </Link>
      <div className={`rounded-xl border border-white/10 bg-white/[0.04] p-4`}>
        <p className={`font-medium ${los.textPrimary}`}>{String(n.title)}</p>
        {n.bodySummary ? (
          <p className={`mt-2 text-sm ${los.textSecondary}`}>{String(n.bodySummary)}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={act.isPending}
          className={`rounded-lg bg-cyan-500/20 px-4 py-3 text-sm font-medium text-cyan-200 ${los.focusRing}`}
          onClick={() => act.mutate({ action: 'OPEN_DETAIL' })}
        >
          {t('mobile.openDetail')}
        </button>
        {linkedType === 'Obligation' ? (
          <>
            <button
              type="button"
              disabled={act.isPending}
              className={`rounded-lg border border-white/15 px-4 py-3 text-sm ${los.focusRing}`}
              onClick={() => act.mutate({ action: 'CONFIRM' })}
            >
              {t('mobile.confirm')}
            </button>
            <button
              type="button"
              disabled={act.isPending}
              className={`rounded-lg border border-white/15 px-4 py-3 text-sm ${los.focusRing}`}
              onClick={() => act.mutate({ action: 'SNOOZE', snoozeMinutes: 240 })}
            >
              {t('mobile.snooze')}
            </button>
            <button
              type="button"
              disabled={act.isPending}
              className={`rounded-lg border border-white/15 px-4 py-3 text-sm ${los.focusRing}`}
              onClick={() => act.mutate({ action: 'DISMISS' })}
            >
              {t('mobile.dismiss')}
            </button>
            <button
              type="button"
              disabled={act.isPending}
              className={`rounded-lg border border-emerald-400/30 px-4 py-3 text-sm text-emerald-200 ${los.focusRing}`}
              onClick={() => act.mutate({ action: 'RESOLVE' })}
            >
              {t('mobile.resolve')}
            </button>
            <Link
              to={`/m/obligations/${linkedId}`}
              className={`block text-center text-sm ${los.accentLink}`}
            >
              {t('mobile.openDetail')}
            </Link>
          </>
        ) : null}
      </div>
      {act.isError ? <p className="text-rose-300">{formatApiError(act.error, t)}</p> : null}
    </div>
  );
}
