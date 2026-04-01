import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { los } from '../../design/tokens';
import { formatApiError } from '../../lib/format-api-error';
import { lifeOsApi } from '../../lib/api';

export default function NotificationInbox() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['notifications-inbox'],
    queryFn: () => lifeOsApi.getNotifications(1),
  });

  if (q.isLoading) return <p className={los.textMuted}>{t('common.loading')}</p>;
  if (q.isError) return <p className="text-rose-300">{formatApiError(q.error, t)}</p>;

  const rows = (q.data?.data ?? []) as Record<string, unknown>[];

  if (rows.length === 0) {
    return (
      <p className={`rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm ${los.textSecondary}`}>
        {t('mobile.emptyInbox')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className={`text-lg font-semibold ${los.textPrimary}`}>{t('mobile.inboxTitle')}</h2>
      <ul className="space-y-2">
        {rows.map((n) => {
          const id = String(n.id);
          const display = n.lockScreenDisplay as { title?: string; body?: string | null } | undefined;
          const title = String(display?.title ?? n.title ?? 'Life OS');
          const body = (display?.body ?? n.bodySummary ?? n.reasonSummary) as string | null;
          const status = String(n.deliveryStatus ?? '');
          const type = String(n.notificationType ?? '');
          const linkedType = String(n.linkedEntityType ?? '');
          const linkedId = String(n.linkedEntityId ?? '');
          const href =
            linkedType === 'Obligation' && linkedId ? `/m/obligations/${linkedId}` : `/m/inbox/${id}`;

          return (
            <li key={id}>
              <Link
                to={href}
                className={`block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 ${los.focusRing}`}
              >
                <p className={`text-sm font-medium ${los.textPrimary}`}>{title}</p>
                {body ? <p className={`mt-1 text-sm ${los.textSecondary}`}>{body}</p> : null}
                <p className={`mt-2 text-[0.65rem] ${los.textMuted}`}>
                  {type} · {status}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
