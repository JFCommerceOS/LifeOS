import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

export default function EveryoneOnboarding() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => lifeOsApi.getSettings() });
  const patch = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchSettings(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['settings'] });
      await qc.invalidateQueries({ queryKey: ['brief-today'] });
    },
  });

  const st = settings.data?.settings as
    | {
        everyoneModeEnabled?: boolean;
        patternSignalsOptIn?: boolean;
        lifestyleInsightsOptIn?: boolean;
        locationIntelligenceOptIn?: boolean;
        onboardingCompletedAt?: string | null;
      }
    | undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">Welcome to Life OS</h1>
        <p className="text-sm text-slate-400">
          Everyone Mode keeps the interface simple: Capture, Obligations, Brief, and only the modules you opt into.
        </p>
      </header>

      <section className="rounded-lg border border-white/10 bg-slate-900/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Step 1 — Core mode</h2>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={st?.everyoneModeEnabled !== false}
            onChange={(e) => patch.mutate({ everyoneModeEnabled: e.target.checked })}
          />
          Keep advanced modules hidden by default
        </label>
      </section>

      <section className="rounded-lg border border-white/10 bg-slate-900/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Step 2 — Optional signals</h2>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.patternSignalsOptIn)}
            onChange={(e) => patch.mutate({ patternSignalsOptIn: e.target.checked })}
          />
          Pattern signals (screen-time/place summaries)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.locationIntelligenceOptIn)}
            onChange={(e) => patch.mutate({ locationIntelligenceOptIn: e.target.checked })}
          />
          Location intelligence hints (event-only, no raw trail)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(st?.lifestyleInsightsOptIn)}
            onChange={(e) => patch.mutate({ lifestyleInsightsOptIn: e.target.checked })}
          />
          Lifestyle routine hints
        </label>
      </section>

      <section className="rounded-lg border border-white/10 bg-slate-900/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Step 3 — Complete</h2>
        <p className="text-xs text-slate-500">
          Status: {st?.onboardingCompletedAt ? 'Completed' : 'Not completed'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded bg-cyan-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ onboardingCompletedAt: new Date().toISOString() })}
          >
            Finish onboarding
          </button>
          <Link to="/" className="text-sm text-cyan-400 hover:underline">
            Go to Daily Brief
          </Link>
        </div>
      </section>
    </div>
  );
}
