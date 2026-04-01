import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { los } from '../design/tokens';
import { lifeOsApi } from '../lib/api';

export default function Privacy() {
  const qc = useQueryClient();
  const inventory = useQuery({ queryKey: ['privacy-inventory'], queryFn: () => lifeOsApi.getPrivacyInventory() });
  const policies = useQuery({ queryKey: ['privacy-policies'], queryFn: () => lifeOsApi.getPrivacyPolicies() });
  const actions = useQuery({ queryKey: ['privacy-actions'], queryFn: () => lifeOsApi.getPrivacyActions(1) });
  const settings = useQuery({ queryKey: ['privacy-settings'], queryFn: () => lifeOsApi.getPrivacy() });

  const exportJob = useMutation({
    mutationFn: () => lifeOsApi.postExportJob({ includeSensitive: false, format: 'json' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['export-jobs'] }),
  });

  const exportJobs = useQuery({
    queryKey: ['export-jobs'],
    queryFn: () => lifeOsApi.getExportJobs(1),
    enabled: exportJob.isSuccess,
  });
  const lastExport = (exportJobs.data?.data as { id?: string; status?: string }[] | undefined)?.[0];

  const cats = inventory.data?.categories ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Privacy and data</h1>
        <p className={`mt-1 text-sm ${los.textMuted}`}>
          See what Life OS stores, why it is kept, and run exports or purges. Deletion is honest: some audit entries may
          remain for security; raw evidence can expire before structured memory.
        </p>
      </div>

      <section className={`rounded-xl border ${los.borderSubtle} bg-[#0F1624]/50 p-4`}>
        <h2 className="text-sm font-medium text-cyan-400">Storage overview</h2>
        <p className={`text-xs ${los.textMuted} mt-1`}>
          Retention days (global): {String(settings.data?.retentionDays ?? '—')} · strict mode:{' '}
          {settings.data?.privacyStrictMode ? 'on' : 'off'} (also in{' '}
          <Link to="/settings" className="text-cyan-400 hover:underline">
            Settings
          </Link>
          ).
        </p>
        {inventory.isLoading ? (
          <p className={`text-sm ${los.textMuted} mt-2`}>Loading inventory…</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {cats.map((c) => (
              <li
                key={c.category}
                className="flex flex-col gap-0.5 rounded-lg border border-zinc-800/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-zinc-200">
                  {c.category.replace(/_/g, ' ')} · {c.count}{' '}
                  <span className="font-normal text-zinc-500">({c.retentionClass})</span>
                </span>
                <span className="text-xs text-zinc-500">
                  {c.sensitivityLevel} · {c.notes}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`rounded-xl border ${los.borderSubtle} bg-[#0F1624]/50 p-4`}>
        <h2 className="text-sm font-medium text-zinc-300">Retention policies</h2>
        {policies.isLoading ? (
          <p className={`text-sm ${los.textMuted}`}>Loading…</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {(policies.data?.policies as { id: string; category: string; retentionClass: string; retentionDays: number | null }[] ?? []).map(
              (p) => (
                <li key={p.id}>
                  {p.category}: {p.retentionClass}
                  {p.retentionDays != null ? ` · ${p.retentionDays}d` : ''}
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className={`rounded-xl border ${los.borderSubtle} bg-[#0F1624]/50 p-4`}>
        <h2 className="text-sm font-medium text-zinc-300">Export (job)</h2>
        <p className={`text-xs ${los.textMuted}`}>
          Creates a JSON bundle (and optional markdown wrapper) stored on the job record for download via API.
        </p>
        <button
          type="button"
          disabled={exportJob.isPending}
          onClick={() => exportJob.mutate()}
          className={`mt-2 ${los.btnSecondary} ${los.focusRing}`}
        >
          Request standard export
        </button>
        {exportJob.isError ? (
          <p className="mt-2 text-xs text-red-400">{(exportJob.error as Error).message}</p>
        ) : null}
        {exportJob.data ? (
          <p className="mt-2 text-xs text-zinc-500">
            Job created. ID: {String((exportJob.data as { job?: { id?: string } }).job?.id ?? '')}
          </p>
        ) : null}
        {lastExport ? (
          <p className="mt-2 text-xs text-zinc-500">
            Latest export job: {lastExport.id} · {lastExport.status}
          </p>
        ) : null}
      </section>

      <section className={`rounded-xl border ${los.borderSubtle} bg-[#0F1624]/50 p-4`}>
        <h2 className="text-sm font-medium text-zinc-300">Privacy actions log</h2>
        {actions.isLoading ? (
          <p className={`text-sm ${los.textMuted}`}>Loading…</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {((actions.data?.data ?? []) as { id: string; actionType: string; status: string; requestedAt: string }[]).map(
              (a) => (
                <li key={a.id}>
                  {a.actionType} · {a.status} · {new Date(a.requestedAt).toLocaleString()}
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className={`rounded-xl border ${los.borderSubtle} p-4`}>
        <h2 className="text-sm font-medium text-zinc-400">Connectors</h2>
        <p className={`text-xs ${los.textMuted}`}>
          Per-connector data summary and purge live under{' '}
          <Link to="/connectors" className="text-cyan-400 hover:underline">
            Connectors
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
