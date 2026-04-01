import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { los } from '../../design/tokens';
import { formatApiError } from '../../lib/format-api-error';
import { lifeOsApi } from '../../lib/api';

type MobileCard = {
  id: string;
  title: string;
  oneLine: string | null;
  reasonSummary: string | null;
  evidenceCount: number;
  priorityScore: number | null;
  deepLink: string;
};

type Sections = Record<string, MobileCard[]>;

export default function MobileDailyBrief() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['mobile-brief-today'],
    queryFn: () => lifeOsApi.getMobileBriefToday(),
  });

  if (q.isLoading) return <p className={los.textMuted}>{t('common.loading')}</p>;
  if (q.isError) {
    return <p className="text-rose-300">{formatApiError(q.error, t)}</p>;
  }

  const sections = (q.data?.sections ?? {}) as Sections;
  const day = q.data?.day as string | undefined;

  const blocks: { key: string; label: string; items: MobileCard[] }[] = [
    { key: 'top_action', label: t('mobile.topAction'), items: sections.top_action ?? [] },
    { key: 'do_now', label: t('mobile.doNow'), items: sections.do_now ?? [] },
    { key: 'do_today', label: t('mobile.doToday'), items: sections.do_today ?? [] },
    { key: 'before_next_event', label: t('mobile.beforeEvent'), items: sections.before_next_event ?? [] },
    { key: 'watch_list', label: t('mobile.watchList'), items: sections.watch_list ?? [] },
    { key: 'admin_due', label: t('mobile.adminDue'), items: sections.admin_due ?? [] },
    { key: 'recent_documents', label: t('mobile.documents'), items: sections.recent_documents ?? [] },
  ];

  const hasAny = blocks.some((b) => b.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold tracking-tight ${los.textPrimary}`}>{t('mobile.briefTitle')}</h2>
        {day ? <p className={`text-xs ${los.textMuted}`}>{new Date(day).toLocaleDateString()}</p> : null}
      </div>

      {!hasAny ? (
        <p className={`rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm ${los.textSecondary}`}>
          {t('mobile.emptyBrief')}
        </p>
      ) : null}

      {blocks.map((block) =>
        block.items.length === 0 ? null : (
          <section key={block.key} className="space-y-2">
            <h3 className={`text-xs font-semibold uppercase tracking-wide ${los.textMuted}`}>{block.label}</h3>
            <ul className="space-y-2">
              {block.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.deepLink}
                    className={`block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-colors hover:bg-white/[0.07] ${los.focusRing}`}
                  >
                    <p className={`font-medium ${los.textPrimary}`}>{item.title}</p>
                    {item.oneLine ? (
                      <p className={`mt-1 text-sm ${los.textSecondary}`}>{item.oneLine}</p>
                    ) : null}
                    {item.reasonSummary ? (
                      <p className={`mt-1 text-xs ${los.textMuted}`}>{item.reasonSummary}</p>
                    ) : null}
                    <p className={`mt-2 text-[0.65rem] ${los.textMuted}`}>
                      {item.evidenceCount ? `${item.evidenceCount} evidence · ` : ''}
                      {item.priorityScore != null ? `priority ${Math.round(item.priorityScore)}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
