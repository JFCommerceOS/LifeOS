import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

export default function Patterns() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => lifeOsApi.getSettings() });
  const patterns = useQuery({ queryKey: ['insights-patterns'], queryFn: () => lifeOsApi.getInsightsPatterns() });
  const financial = useQuery({ queryKey: ['insights-financial'], queryFn: () => lifeOsApi.getInsightsFinancial() });
  const places = useQuery({ queryKey: ['place-events'], queryFn: () => lifeOsApi.getPlaceEvents(1) });
  const screenRows = useQuery({ queryKey: ['screen-time'], queryFn: () => lifeOsApi.getScreenTimeSummaries(1) });

  const patchSettings = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchSettings(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['insights-patterns'] });
    },
  });

  const [label, setLabel] = useState('Errands');
  const [cat, setCat] = useState('errands');
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalMin, setTotalMin] = useState(180);
  const [lateNight, setLateNight] = useState(30);

  const addPlace = useMutation({
    mutationFn: () =>
      lifeOsApi.postPlaceEvent({
        occurredAt: new Date().toISOString(),
        placeLabel: label,
        placeCategory: cat || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['place-events'] });
      void qc.invalidateQueries({ queryKey: ['insights-patterns'] });
    },
  });

  const addScreen = useMutation({
    mutationFn: () =>
      lifeOsApi.postScreenTimeSummary({
        day,
        totalMinutes: totalMin,
        lateNightMinutes: lateNight,
        categoryMinutesJson: JSON.stringify({ productivity: Math.max(0, totalMin - lateNight) }),
      }),
      onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['screen-time'] });
      void qc.invalidateQueries({ queryKey: ['insights-patterns'] });
    },
  });

  const recentScreen = (screenRows.data?.data ?? []) as {
    id: string;
    day: string;
    totalMinutes: number;
    lateNightMinutes: number;
  }[];

  const s = settings.data?.settings as { patternSignalsOptIn?: boolean } | undefined;

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Patterns &amp; signals</h1>
        <div className="flex gap-3 text-sm">
          <Link to="/places" className="text-cyan-400 hover:underline">
            Places
          </Link>
          <Link to="/settings" className="text-cyan-400 hover:underline">
            Settings
          </Link>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        Phase 4 — summarized place visits and screen-time metadata only. Opt in before insights use this data.
        Manage saved place labels on the Places page (Sprint 13).
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(s?.patternSignalsOptIn)}
          onChange={(e) => patchSettings.mutate({ patternSignalsOptIn: e.target.checked })}
        />
        Enable pattern signals (location/screen-time summaries)
      </label>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
        <h2 className="text-sm font-medium text-cyan-400">Pattern insights</h2>
        {patterns.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
            {(patterns.data?.bullets ?? []).map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {(patterns.data?.poorReminderWindows ?? []).length > 0 ? (
          <div className="text-xs text-amber-200/90">
            {(patterns.data?.poorReminderWindows ?? []).map((x, i) => (
              <p key={i}>{x}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Financial continuity</h2>
        {financial.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <>
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Duplicate-ish spend</h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                {(financial.data?.duplicateSpendHints ?? []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Subscriptions</h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                {(financial.data?.subscriptionSignals ?? []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Log place visit (generalized)</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
          />
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            placeholder="category"
          />
          <button
            type="button"
            className="rounded bg-cyan-600 px-3 py-1 text-sm text-white"
            onClick={() => addPlace.mutate()}
          >
            Add
          </button>
        </div>
        <ul className="text-xs text-zinc-500 space-y-1">
          {((places.data?.data ?? []) as { id: string; placeLabel: string; occurredAt: string }[]).map(
            (p) => (
              <li key={p.id}>
                {p.placeLabel} — {new Date(p.occurredAt).toLocaleString()}
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Screen time summary (metadata)</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-zinc-500">
            Day
            <input
              type="date"
              className="block mt-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Total min
            <input
              type="number"
              className="block mt-1 w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
              value={totalMin}
              onChange={(e) => setTotalMin(Number(e.target.value))}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Late night min
            <input
              type="number"
              className="block mt-1 w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
              value={lateNight}
              onChange={(e) => setLateNight(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="rounded bg-cyan-600 px-3 py-1.5 text-sm text-white"
            onClick={() => addScreen.mutate()}
          >
            Save day
          </button>
        </div>
        {recentScreen.length > 0 ? (
          <ul className="text-xs text-zinc-500 space-y-1 mt-2">
            {recentScreen.map((r) => (
              <li key={r.id}>
                {String(r.day).slice(0, 10)} — total {r.totalMinutes}m, late night {r.lateNightMinutes}m
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
