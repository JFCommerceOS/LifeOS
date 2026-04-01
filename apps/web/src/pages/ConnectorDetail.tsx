import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { los } from '../design/tokens';
import { lifeOsApi } from '../lib/api';

export default function ConnectorDetail() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ['connector', id],
    queryFn: () => lifeOsApi.getConnector(id!),
    enabled: Boolean(id),
  });

  const connector = q.data?.connector as Record<string, unknown> | undefined;
  const recentRuns = (q.data?.recentRuns ?? []) as {
    id: string;
    runType: string;
    runStatus: string;
    recordsSeen: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsFailed: number;
    createdAt: string;
  }[];

  if (!id) {
    return (
      <p className={los.textMuted}>
        Missing id. <Link to="/connectors" className="text-cyan-400">Back</Link>
      </p>
    );
  }

  if (q.isLoading) return <p className={los.textMuted}>Loading…</p>;
  if (q.isError || !connector) {
    return (
      <p className="text-red-400">
        {(q.error as Error)?.message ?? 'Not found'}{' '}
        <Link to="/connectors" className="text-cyan-400 underline">
          Back
        </Link>
      </p>
    );
  }

  const perms = (connector.permissions as { permissionKey: string; granted: boolean }[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <p>
        <Link to="/connectors" className="text-sm text-cyan-400 hover:underline">
          ← Connectors
        </Link>
      </p>
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">{String(connector.name ?? '')}</h1>
        <p className="text-sm text-zinc-500">
          {String(connector.connectorType ?? connector.type ?? '')} · {String(connector.status ?? '')} ·{' '}
          {connector.enabled ? 'enabled' : 'disabled'}
        </p>
      </div>

      <section className={`rounded-xl border ${los.borderSubtle} p-4`}>
        <h2 className="text-sm font-medium text-zinc-300">Permissions</h2>
        {perms.length === 0 ? (
          <p className={`text-sm ${los.textMuted}`}>None — use Connect on the list to grant defaults.</p>
        ) : (
          <ul className="mt-2 text-sm text-zinc-400">
            {perms.map((p) => (
              <li key={p.permissionKey}>
                {p.permissionKey}: {p.granted ? 'granted' : 'off'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`rounded-xl border ${los.borderSubtle} p-4`}>
        <h2 className="text-sm font-medium text-zinc-300">Recent sync runs</h2>
        {recentRuns.length === 0 ? (
          <p className={`text-sm ${los.textMuted}`}>No runs yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-zinc-400">
            {recentRuns.map((r) => (
              <li key={r.id}>
                {r.runType} · {r.runStatus} · seen {r.recordsSeen} · +{r.recordsInserted} / ~{r.recordsUpdated} · fail{' '}
                {r.recordsFailed}{' '}
                <span className="text-zinc-600">{new Date(r.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
