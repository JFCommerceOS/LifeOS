import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';
import { los } from '../design/tokens';

export default function AdaptationInspector() {
  const q = useQuery({
    queryKey: ['profile-adaptation'],
    queryFn: () => lifeOsApi.getProfileAdaptationState(),
  });
  const logs = useQuery({
    queryKey: ['profile-adaptation-logs'],
    queryFn: () => lifeOsApi.getProfileAdaptationLogs(1),
  });

  if (q.isLoading) return <p className={los.textMuted}>Loading…</p>;
  if (q.isError) return <p className="text-rose-300">{(q.error as Error).message}</p>;

  const d = q.data as Record<string, unknown>;
  const declared = d.declared as Record<string, unknown> | null | undefined;
  const inferred = (d.inferred as Record<string, unknown>[]) ?? [];
  const modifiers = d.currentModifiers as Record<string, unknown> | undefined;
  const mode = d.activeMode as { mode?: string; source?: string } | undefined;

  return (
    <div className={`mx-auto max-w-2xl space-y-8 ${los.textPrimary}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Adaptation inspector</h1>
          <p className={`mt-1 text-sm ${los.textSecondary}`}>
            Declared vs inferred — everything here is correctable in Profile & priority.
          </p>
        </div>
        <Link to="/profile/priority" className={`text-sm ${los.accentLink}`}>
          ← Edit profile
        </Link>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className={`text-sm font-medium ${los.textSecondary}`}>Active mode</h2>
        <pre className={`mt-2 overflow-x-auto text-xs ${los.textMuted}`}>
          {JSON.stringify(mode, null, 2)}
        </pre>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className={`text-sm font-medium ${los.textSecondary}`}>Declared slice</h2>
        <pre className={`mt-2 overflow-x-auto text-xs ${los.textMuted}`}>
          {JSON.stringify(declared, null, 2)}
        </pre>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className={`text-sm font-medium ${los.textSecondary}`}>Current modifiers (effective)</h2>
        <pre className={`mt-2 overflow-x-auto text-xs ${los.textMuted}`}>
          {JSON.stringify(modifiers, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className={`text-sm font-medium ${los.textSecondary}`}>Inferred states (active)</h2>
        {inferred.length === 0 ? (
          <p className={`text-sm ${los.textMuted}`}>No active inferred preferences yet.</p>
        ) : (
          <ul className="space-y-2">
            {inferred.map((row) => (
              <li
                key={String(row.id)}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm"
              >
                <p className="font-medium text-slate-200">{String(row.preferenceKey)}</p>
                {row.reasonSummary ? (
                  <p className={`mt-1 text-xs ${los.textSecondary}`}>{String(row.reasonSummary)}</p>
                ) : null}
                <p className={`mt-1 text-[0.65rem] ${los.textMuted}`}>{String(row.inferredValueJson)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className={`text-sm font-medium ${los.textSecondary}`}>Recent adaptation logs</h2>
        {logs.isLoading ? (
          <p className={los.textMuted}>Loading logs…</p>
        ) : (
          <pre className={`mt-2 max-h-64 overflow-auto text-xs ${los.textMuted}`}>
            {JSON.stringify(logs.data?.data ?? [], null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
