import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { los } from '../design/tokens';
import { lifeOsApi } from '../lib/api';

type ConnectorRow = {
  id: string;
  name: string;
  type: string;
  connectorType?: string;
  status?: string;
  enabled?: boolean;
  lastSyncAt?: string | null;
  _count?: { records?: number; syncRuns?: number };
};

export default function Connectors() {
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['connector-catalog'], queryFn: () => lifeOsApi.getConnectorCatalog() });
  const list = useQuery({ queryKey: ['connectors'], queryFn: () => lifeOsApi.getConnectors() });

  const [name, setName] = useState('My calendar');
  const [connectorType, setConnectorType] = useState<'STUB' | 'CALENDAR' | 'TASKS' | 'EMAIL_METADATA'>('CALENDAR');

  const create = useMutation({
    mutationFn: () => lifeOsApi.postConnector({ connectorType, name }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const connect = useMutation({
    mutationFn: (id: string) => lifeOsApi.postConnectorConnect(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const sync = useMutation({
    mutationFn: (id: string) => lifeOsApi.postConnectorSync(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const pause = useMutation({
    mutationFn: (id: string) => lifeOsApi.postConnectorPause(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const purge = useMutation({
    mutationFn: (id: string) => lifeOsApi.postConnectorPurge(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => lifeOsApi.postConnectorDisconnect(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const resync = useMutation({
    mutationFn: (id: string) => lifeOsApi.postConnectorResync(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['connectors'] }),
  });

  const rows = (list.data?.connectors ?? []) as ConnectorRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Connectors</h1>
        <p className={`mt-1 text-sm ${los.textMuted}`}>
          Purpose-scoped sources you turn on explicitly. Sync is manual or scheduled (scheduled is a placeholder). No full
          inbox ingestion by default.
        </p>
      </div>

      <section className={`rounded-xl border ${los.borderSubtle} bg-[#0F1624]/50 p-4`}>
        <h2 className="text-sm font-medium text-cyan-400">Available connector types</h2>
        {catalog.isLoading ? (
          <p className={`text-sm ${los.textMuted}`}>Loading…</p>
        ) : (
          <ul className="mt-2 space-y-3 text-sm text-zinc-300">
            {(catalog.data?.catalog as { title: string; purpose: string; collects: string[]; doesNotCollect: string[] }[] ?? []).map(
              (c) => (
                <li key={c.title} className="rounded-lg border border-zinc-800/80 p-3">
                  <p className="font-medium text-zinc-100">{c.title}</p>
                  <p className="text-zinc-500">{c.purpose}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Collects: {c.collects.join(', ')}. Does not: {c.doesNotCollect.join(', ')}.
                  </p>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className={`rounded-xl border ${los.borderSubtle} bg-[#0F1624]/50 p-4`}>
        <h2 className="text-sm font-medium text-zinc-300">Add connector</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            className={`${los.input} max-w-[11rem]`}
            value={connectorType}
            onChange={(e) =>
              setConnectorType(e.target.value as 'STUB' | 'CALENDAR' | 'TASKS' | 'EMAIL_METADATA')
            }
            aria-label="Connector type"
          >
            <option value="CALENDAR">Calendar</option>
            <option value="TASKS">Tasks</option>
            <option value="EMAIL_METADATA">Email metadata</option>
            <option value="STUB">Stub (dev)</option>
          </select>
          <input
            className={`${los.input} max-w-[14rem]`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
          />
          <button
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate()}
            className={`${los.btnSecondary} ${los.focusRing}`}
          >
            Create
          </button>
        </div>
        {create.isError ? <p className="mt-2 text-xs text-red-400">{(create.error as Error).message}</p> : null}
      </section>

      <section className={`rounded-xl border ${los.borderSubtle} bg-[#0F1624]/50 p-4`}>
        <h2 className="text-sm font-medium text-zinc-300">Your connectors</h2>
        {list.isLoading ? (
          <p className={`text-sm ${los.textMuted}`}>Loading…</p>
        ) : rows.length === 0 ? (
          <p className={`text-sm ${los.textMuted}`}>None yet — create one above, then Connect, then Sync now.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-800/80 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link to={`/connectors/${c.id}`} className="font-medium text-cyan-400 hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-zinc-500">
                    {' '}
                    · {c.connectorType ?? c.type} · {c.status ?? '—'} ·{' '}
                    {c.enabled ? 'enabled' : 'disabled'}
                  </span>
                  {c.lastSyncAt ? (
                    <span className="block text-xs text-zinc-500">Last sync: {new Date(c.lastSyncAt).toLocaleString()}</span>
                  ) : null}
                  {c._count?.records != null ? (
                    <span className="block text-xs text-zinc-500">Source records: {c._count.records}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200"
                    onClick={() => connect.mutate(c.id)}
                  >
                    Connect
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200"
                    onClick={() => sync.mutate(c.id)}
                  >
                    Sync now
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200"
                    onClick={() => pause.mutate(c.id)}
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200"
                    onClick={() => resync.mutate(c.id)}
                  >
                    Resync
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200"
                    onClick={() => disconnect.mutate(c.id)}
                  >
                    Disconnect
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-900/60 px-2 py-1 text-xs text-red-300"
                    onClick={() => {
                      if (window.confirm('Purge imported rows for this connector?')) purge.mutate(c.id);
                    }}
                  >
                    Purge data
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
