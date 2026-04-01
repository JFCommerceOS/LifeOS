import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ConfidencePill } from '../components/brief/ConfidencePill';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

export default function MemoryDetail() {
  const { memoryId } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctedConfidence, setCorrectedConfidence] = useState('');

  const q = useQuery({
    queryKey: ['memory', 'detail', memoryId],
    queryFn: () => lifeOsApi.getMemoryNode(memoryId!),
    enabled: Boolean(memoryId),
  });

  const confirm = useMutation({
    mutationFn: () => lifeOsApi.postMemoryConfirm({ memoryNodeId: memoryId!, confirmed: true }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['memory'] }),
  });

  const correct = useMutation({
    mutationFn: () =>
      lifeOsApi.postMemoryCorrect({
        memoryNodeId: memoryId!,
        correctionNote: correctionNote.trim() || t('memory.defaultCorrection'),
        correctedFields:
          correctedConfidence.trim() !== ''
            ? { confidence: Number.parseFloat(correctedConfidence) }
            : undefined,
      }),
    onSuccess: () => {
      setCorrectionNote('');
      setCorrectedConfidence('');
      void qc.invalidateQueries({ queryKey: ['memory'] });
    },
  });

  if (!memoryId) return <p className={los.textMuted}>Missing id</p>;
  if (q.isLoading) return <p className={los.textMuted}>{t('common.loading')}</p>;
  if (q.isError) {
    return (
      <p className="text-rose-300" role="alert">
        {formatApiError(q.error, t)}
      </p>
    );
  }

  const node = q.data?.node as Record<string, unknown> | undefined;
  const lineage = q.data?.lineage as Record<string, unknown> | undefined;
  if (!node) return <p className={los.textMuted}>Not found</p>;

  const summary = String(node.summary ?? '');
  const conf = typeof node.confidence === 'number' ? node.confidence : null;

  return (
    <div className={`${los.page} space-y-8`}>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/memory" className={`${los.accentLink}`}>
          ← {t('nav.memory')}
        </Link>
        <Link to="/" className={`${los.accentLink}`}>
          {t('nav.brief')}
        </Link>
      </div>

      <SectionHeader title={t('memory.detailTitle')} subtitle={String(node.nodeType ?? '')} />

      <div className={`${los.surfaceCard} space-y-4 p-5`}>
        <p className="text-[15px] leading-relaxed text-slate-100">{summary}</p>
        <ConfidencePill confidence={conf} evidenceCount={null} />
        <dl className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Layer</dt>
            <dd>{String(node.layerType ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Source</dt>
            <dd>
              {node.refEntityType ? `${String(node.refEntityType)} · ${String(node.refEntityId ?? '')}` : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {lineage?.relatedSuggestions && Array.isArray(lineage.relatedSuggestions) && lineage.relatedSuggestions.length > 0 ? (
        <div className={`${los.surfaceCard} p-5`}>
          <h3 className="text-sm font-medium text-slate-200">Related suggestions</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {(lineage.relatedSuggestions as { id: string; title: string }[]).map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {lineage?.relatedObligations && Array.isArray(lineage.relatedObligations) && lineage.relatedObligations.length > 0 ? (
        <div className={`${los.surfaceCard} p-5`}>
          <h3 className="text-sm font-medium text-slate-200">Related obligations</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {(lineage.relatedObligations as { id: string; title: string }[]).map((o) => (
              <li key={o.id}>
                <Link to="/obligations" className={los.accentLink}>
                  {o.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${los.btnPrimary} ${los.focusRing}`}
          onClick={() => void confirm.mutateAsync()}
          disabled={confirm.isPending}
        >
          {t('memory.confirm')}
        </button>
      </div>

      <div className={`${los.surfaceCard} space-y-3 p-5`}>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('memory.correctionNote')}
          <textarea
            value={correctionNote}
            onChange={(e) => setCorrectionNote(e.target.value)}
            rows={3}
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Optional: corrected confidence (0–1)
          <input
            value={correctedConfidence}
            onChange={(e) => setCorrectedConfidence(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200"
            placeholder="0.42"
          />
        </label>
        <button
          type="button"
          className={`${los.btnSecondary} ${los.focusRing}`}
          onClick={() => void correct.mutateAsync()}
          disabled={correct.isPending}
        >
          {t('memory.saveCorrection')}
        </button>
      </div>
    </div>
  );
}
