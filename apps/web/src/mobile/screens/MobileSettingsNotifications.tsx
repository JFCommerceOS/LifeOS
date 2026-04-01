import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { los } from '../../design/tokens';
import { formatApiError } from '../../lib/format-api-error';
import { lifeOsApi } from '../../lib/api';

export default function MobileSettingsNotifications() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => lifeOsApi.getNotificationPreferences(),
  });

  const mu = useMutation({
    mutationFn: (body: Record<string, unknown>) => lifeOsApi.patchNotificationPreferences(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  if (q.isLoading) return <p className={los.textMuted}>{t('common.loading')}</p>;
  if (q.isError) return <p className="text-rose-300">{formatApiError(q.error, t)}</p>;

  const p = (q.data?.preferences ?? {}) as Record<string, unknown>;

  const lock = String(p.lockScreenMode ?? 'private_default');
  const qh = Boolean(p.quietHoursEnabled);

  return (
    <div className="space-y-6">
      <Link to="/m" className={`text-sm ${los.accentLink}`}>
        ← {t('mobile.briefTitle')}
      </Link>
      <h2 className={`text-lg font-semibold ${los.textPrimary}`}>{t('mobile.settingsTitle')}</h2>

      <label className={`block text-sm ${los.textSecondary}`}>
        {t('mobile.lockScreen')}
        <select
          className={`mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 ${los.textPrimary}`}
          value={lock}
          onChange={(e) => mu.mutate({ lockScreenMode: e.target.value })}
        >
          <option value="private_default">Private default</option>
          <option value="redacted_reason">Redacted reason</option>
          <option value="full_detail">Full detail (opt-in)</option>
        </select>
      </label>

      <div className="flex items-center justify-between gap-3">
        <span className={`text-sm ${los.textSecondary}`}>{t('mobile.quietHours')}</span>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs ${qh ? 'bg-cyan-500/30' : 'bg-white/10'} ${los.focusRing}`}
          onClick={() => mu.mutate({ quietHoursEnabled: !qh })}
        >
          {qh ? 'On' : 'Off'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className={`text-xs ${los.textMuted}`}>
          {t('mobile.quietStart')}
          <input
            type="text"
            placeholder="22:00"
            defaultValue={String(p.quietHoursStart ?? '')}
            className={`mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) mu.mutate({ quietHoursStart: v });
            }}
          />
        </label>
        <label className={`text-xs ${los.textMuted}`}>
          {t('mobile.quietEnd')}
          <input
            type="text"
            placeholder="07:00"
            defaultValue={String(p.quietHoursEnd ?? '')}
            className={`mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) mu.mutate({ quietHoursEnd: v });
            }}
          />
        </label>
      </div>

      {mu.isError ? <p className="text-rose-300">{formatApiError(mu.error, t)}</p> : null}
      {mu.isSuccess ? <p className={`text-xs ${los.textMuted}`}>Updated.</p> : null}
    </div>
  );
}
