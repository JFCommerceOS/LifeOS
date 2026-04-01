import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

export default function DocumentDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['documents', 'detail', id],
    queryFn: () => lifeOsApi.getDocument(id!),
    enabled: Boolean(id),
  });

  const archiveFeedback = useMutation({
    mutationFn: () =>
      lifeOsApi.postDocumentFeedback(id!, {
        feedbackType: 'ARCHIVE_ONLY',
        note: 'User marked archive-only from web',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const suppressTracking = useMutation({
    mutationFn: () =>
      lifeOsApi.postDocumentFeedback(id!, {
        feedbackType: 'SUPPRESS_TRACKING',
        note: 'User suppressed tracking',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  if (!id) return <p className={los.textMuted}>Missing id</p>;
  if (q.isLoading) return <p className={los.textMuted}>{t('common.loading')}</p>;
  if (q.isError) {
    return (
      <p className="text-rose-300" role="alert">
        {formatApiError(q.error, t)}
      </p>
    );
  }

  const doc = q.data?.document as Record<string, unknown> | undefined;
  if (!doc) return <p className={los.textMuted}>Not found</p>;

  const deadlines = (doc.deadlines as { id: string; deadlineType: string; dueAt: string | null }[]) ?? [];
  const fields =
    (doc.extractedFields as { id: string; fieldName: string; fieldValueJson: string; confidence: number }[]) ?? [];
  const evidence = (doc.evidenceItems as { id: string; summary: string; kind: string }[]) ?? [];

  return (
    <div className={`${los.page} space-y-8`}>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/documents" className={los.accentLink}>
          ← {t('documents.title')}
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{String(doc.title ?? '')}</h1>
        <p className={`mt-2 text-sm ${los.textMuted}`}>
          {String(doc.documentFamily ?? '')} · {String(doc.documentSubtype ?? '')} ·{' '}
          {String(doc.processingStatus ?? '')}
        </p>
        {doc.summaryLine ? (
          <p className={`mt-3 max-w-2xl text-[15px] leading-relaxed ${los.textSecondary}`}>
            {String(doc.summaryLine)}
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={suppressTracking.isPending}
          onClick={() => suppressTracking.mutate()}
          className={`rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 ${los.focusRing} disabled:opacity-40`}
        >
          {t('documents.actionSuppress')}
        </button>
        <button
          type="button"
          disabled={archiveFeedback.isPending}
          onClick={() => archiveFeedback.mutate()}
          className={`rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 ${los.focusRing} disabled:opacity-40`}
        >
          {t('documents.actionArchive')}
        </button>
      </div>
      {(suppressTracking.isError || archiveFeedback.isError) && (
        <p className="text-sm text-rose-300" role="alert">
          {formatApiError(suppressTracking.error ?? archiveFeedback.error, t)}
        </p>
      )}

      {deadlines.length > 0 ? (
        <section>
          <SectionHeader title={t('documents.sectionDeadlines')} />
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {deadlines.map((d) => (
              <li key={d.id}>
                {d.deadlineType}
                {d.dueAt ? ` · ${new Date(d.dueAt).toLocaleString()}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {fields.length > 0 ? (
        <section>
          <SectionHeader title={t('documents.sectionFields')} />
          <ul className="mt-3 space-y-2 font-mono text-xs text-slate-400">
            {fields.map((f) => (
              <li key={f.id}>
                <span className="text-slate-500">{f.fieldName}</span> = {f.fieldValueJson}{' '}
                <span className="text-slate-600">({Math.round(f.confidence * 100)}%)</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {evidence.length > 0 ? (
        <section>
          <SectionHeader title={t('documents.sectionEvidence')} />
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {evidence.map((e) => (
              <li key={e.id}>
                [{e.kind}] {e.summary}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
