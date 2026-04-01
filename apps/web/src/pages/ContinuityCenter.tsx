import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { los } from '../design/tokens';
import { lifeOsApi } from '../lib/api';

type Tab = 'sync' | 'jobs' | 'conflicts' | 'why';

export default function ContinuityCenter() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('sync');
  const [whyType, setWhyType] = useState('Obligation');
  const [whyId, setWhyId] = useState('');

  const syncStatusQ = useQuery({
    queryKey: ['continuity', 'sync-status'],
    queryFn: () => lifeOsApi.getSyncStatus(),
  });
  const outboxQ = useQuery({
    queryKey: ['continuity', 'outbox'],
    queryFn: () => lifeOsApi.getSyncOutbox(1),
    enabled: tab === 'sync',
  });
  const jobsQ = useQuery({
    queryKey: ['continuity', 'jobs'],
    queryFn: () => lifeOsApi.getScheduledJobs(1),
    enabled: tab === 'jobs',
  });
  const conflictsQ = useQuery({
    queryKey: ['continuity', 'conflicts'],
    queryFn: () => lifeOsApi.getConflicts(1),
    enabled: tab === 'conflicts',
  });
  const tracesQ = useQuery({
    queryKey: ['continuity', 'traces'],
    queryFn: () => lifeOsApi.getDiagnosticsTraces(1),
    enabled: tab === 'why',
  });
  const explanationsQ = useQuery({
    queryKey: ['continuity', 'explanations', whyType, whyId],
    queryFn: () => lifeOsApi.getDiagnosticsExplanations(whyType, whyId, 1),
    enabled: tab === 'why' && whyId.length > 0,
  });
  const projectionsQ = useQuery({
    queryKey: ['continuity', 'projections'],
    queryFn: () => lifeOsApi.getDiagnosticsProjections(1),
    enabled: tab === 'why',
  });

  const pauseM = useMutation({
    mutationFn: () => lifeOsApi.postSyncPause(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['continuity'] }),
  });
  const resumeM = useMutation({
    mutationFn: () => lifeOsApi.postSyncResume(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['continuity'] }),
  });
  const refreshM = useMutation({
    mutationFn: () => lifeOsApi.postProjectionsRefresh({ projectionType: 'daily_brief' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['continuity'] }),
  });

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      className={`rounded-lg px-3 py-1.5 text-sm ${los.focusRing} ${
        tab === id ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-400 hover:text-slate-200'
      }`}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className={los.page}>
      <PageHeader title={t('continuity.title')} tagline={t('continuity.subtitle')} />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabBtn('sync', t('continuity.tabSync'))}
        {tabBtn('jobs', t('continuity.tabJobs'))}
        {tabBtn('conflicts', t('continuity.tabConflicts'))}
        {tabBtn('why', t('continuity.tabWhy'))}
      </div>

      {tab === 'sync' && (
        <section className={`rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
          <h2 className="text-lg font-semibold text-slate-100">{t('continuity.syncHeading')}</h2>
          <p className={`mt-2 text-sm ${los.textSecondary}`}>{t('continuity.syncHint')}</p>
          {syncStatusQ.data && (
            <dl className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">{t('continuity.paused')}</dt>
                <dd>{syncStatusQ.data.paused ? t('common.yes') : t('common.no')}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('continuity.lastApply')}</dt>
                <dd>{syncStatusQ.data.lastSuccessfulApplyAt ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">{t('continuity.counts')}</dt>
                <dd className="font-mono text-xs">{JSON.stringify(syncStatusQ.data.counts)}</dd>
              </div>
            </dl>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100 ${los.focusRing}`}
              onClick={() => pauseM.mutate()}
            >
              {t('continuity.pauseSync')}
            </button>
            <button
              type="button"
              className={`rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100 ${los.focusRing}`}
              onClick={() => resumeM.mutate()}
            >
              {t('continuity.resumeSync')}
            </button>
          </div>
          <h3 className="mt-8 text-sm font-medium text-slate-200">{t('continuity.outbox')}</h3>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
            {outboxQ.isLoading ? '…' : JSON.stringify(outboxQ.data, null, 2)}
          </pre>
        </section>
      )}

      {tab === 'jobs' && (
        <section className={`rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
          <h2 className="text-lg font-semibold text-slate-100">{t('continuity.jobsHeading')}</h2>
          <p className={`mt-2 text-sm ${los.textSecondary}`}>{t('continuity.jobsHint')}</p>
          <div className="mt-4">
            <button
              type="button"
              className={`rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 ${los.focusRing}`}
              onClick={() => refreshM.mutate()}
            >
              {t('continuity.enqueueProjection')}
            </button>
          </div>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
            {jobsQ.isLoading ? '…' : JSON.stringify(jobsQ.data, null, 2)}
          </pre>
        </section>
      )}

      {tab === 'conflicts' && (
        <section className={`rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
          <h2 className="text-lg font-semibold text-slate-100">{t('continuity.conflictsHeading')}</h2>
          <p className={`mt-2 text-sm ${los.textSecondary}`}>{t('continuity.conflictsHint')}</p>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
            {conflictsQ.isLoading ? '…' : JSON.stringify(conflictsQ.data, null, 2)}
          </pre>
        </section>
      )}

      {tab === 'why' && (
        <section className={`rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
          <h2 className="text-lg font-semibold text-slate-100">{t('continuity.whyHeading')}</h2>
          <p className={`mt-2 text-sm ${los.textSecondary}`}>{t('continuity.whyHint')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-400">
              {t('continuity.entityType')}
              <input
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100"
                value={whyType}
                onChange={(e) => setWhyType(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-400">
              {t('continuity.entityId')}
              <input
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-100"
                value={whyId}
                onChange={(e) => setWhyId(e.target.value)}
                placeholder="cuid…"
              />
            </label>
          </div>
          <h3 className="mt-6 text-sm font-medium text-slate-200">{t('continuity.explanations')}</h3>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
            {whyId.length === 0
              ? t('continuity.enterEntity')
              : explanationsQ.isLoading
                ? '…'
                : JSON.stringify(explanationsQ.data, null, 2)}
          </pre>
          <h3 className="mt-6 text-sm font-medium text-slate-200">{t('continuity.traces')}</h3>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
            {tracesQ.isLoading ? '…' : JSON.stringify(tracesQ.data, null, 2)}
          </pre>
          <h3 className="mt-6 text-sm font-medium text-slate-200">{t('continuity.projectionHistory')}</h3>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
            {projectionsQ.isLoading ? '…' : JSON.stringify(projectionsQ.data, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
