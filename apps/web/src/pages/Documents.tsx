import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState } from '../components/ui/EmptyState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

export default function Documents() {
  const { t } = useTranslation();
  const list = useQuery({
    queryKey: ['documents'],
    queryFn: () => lifeOsApi.getDocuments(1),
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
      <p className="text-rose-300" role="alert">
        {formatApiError(list.error, t)}
      </p>
    );
  }

  const rows = (list.data?.data ?? []) as {
    id: string;
    title: string;
    fileName: string | null;
    documentFamily: string;
    documentSubtype: string;
    processingStatus: string;
    classificationConfidence: number | null;
    summaryLine: string | null;
    createdAt: string;
  }[];

  return (
    <div className={los.page}>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">
          {t('documents.title')}
        </h1>
        <p className={`mt-2 max-w-xl text-[15px] leading-relaxed ${los.textSecondary}`}>
          {t('documents.tagline')}
        </p>
      </header>

      <section className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link className={`${los.accentLink}`} to="/capture">
          {t('documents.linkCapture')}
        </Link>
      </section>

      <SectionHeader title={t('documents.inbox')} />
      {rows.length === 0 ? (
        <EmptyState title={t('documents.emptyTitle')} description={t('documents.emptyBody')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
            <li key={d.id}>
              <Link
                to={`/documents/${d.id}`}
                className={`block rounded-xl border border-white/10 bg-[#0F1624]/80 p-4 transition-colors hover:border-cyan-500/25 ${los.focusRing}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-100">{d.title}</span>
                  <span className={`text-xs ${los.textMuted}`}>{d.processingStatus}</span>
                </div>
                <p className={`mt-1 text-sm ${los.textSecondary}`}>
                  {d.documentFamily} · {d.documentSubtype}
                  {d.classificationConfidence != null
                    ? ` · ${Math.round(d.classificationConfidence * 100)}%`
                    : ''}
                </p>
                {d.summaryLine ? (
                  <p className={`mt-2 text-xs ${los.textMuted}`}>{d.summaryLine}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
