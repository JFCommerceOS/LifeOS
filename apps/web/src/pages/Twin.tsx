import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

type Tab = 'model' | 'planning';

type InferredRow = {
  key: string;
  label: string;
  summary: string;
  confidence: number;
  evidence: string[];
  userNote?: string;
  hiddenByUser: boolean;
};

export default function Twin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('model');
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => lifeOsApi.getSettings() });
  const twin = useQuery({ queryKey: ['digital-twin'], queryFn: () => lifeOsApi.getDigitalTwin() });
  const planning = useQuery({
    queryKey: ['planning-adaptive'],
    queryFn: () => lifeOsApi.getPlanningAdaptive(),
    enabled: tab === 'planning',
  });

  const patchSettings = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchSettings(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['digital-twin'] });
      void qc.invalidateQueries({ queryKey: ['planning-adaptive'] });
    },
  });

  const patchTwin = useMutation({
    mutationFn: (body: {
      traitCorrections?: Record<string, { note?: string; overrideSummary?: string }>;
      disabledInferenceKeys?: string[];
    }) => lifeOsApi.patchDigitalTwin(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['digital-twin'] }),
  });

  const purgeTwin = useMutation({
    mutationFn: (scope: 'all' | 'corrections' | 'visibility') =>
      lifeOsApi.postDigitalTwinPurge({ scope }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['digital-twin'] });
    },
  });

  const [noteKey, setNoteKey] = useState('workload_load');
  const [noteText, setNoteText] = useState('');
  const [overrideText, setOverrideText] = useState('');

  const st = settings.data?.settings as { predictiveModeOptIn?: boolean } | undefined;

  const inferredRows = (twin.data?.inferred ?? []) as InferredRow[];
  const visibleInferred = useMemo(() => inferredRows.filter((r) => !r.hiddenByUser), [inferredRows]);
  const hiddenInferred = useMemo(() => inferredRows.filter((r) => r.hiddenByUser), [inferredRows]);

  const disabledKeys = (twin.data?.disabledInferenceKeys ?? []) as string[];

  const toggleHide = (key: string, hide: boolean) => {
    const next = new Set(disabledKeys);
    if (hide) next.add(key);
    else next.delete(key);
    patchTwin.mutate({ disabledInferenceKeys: [...next] });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Co-pilot &amp; digital twin</h1>
        <Link to="/settings" className="text-sm text-cyan-400 hover:underline">
          Settings
        </Link>
      </div>
      <p className="text-sm text-zinc-500">
        Phase 6 — inspect how Life OS models your preferences, correct inferences, and review explainable
        planning cards. Nothing runs automatically without your existing flows.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(st?.predictiveModeOptIn)}
          onChange={(e) => patchSettings.mutate({ predictiveModeOptIn: e.target.checked })}
        />
        Predictive co-pilot (adaptive planning cards)
      </label>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          className={`rounded px-3 py-1 text-sm ${
            tab === 'model' ? 'bg-cyan-950/40 text-cyan-300' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={() => setTab('model')}
        >
          Twin model
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1 text-sm ${
            tab === 'planning' ? 'bg-cyan-950/40 text-cyan-300' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={() => setTab('planning')}
        >
          Adaptive planning
        </button>
      </div>

      {tab === 'model' ? (
        <div className="space-y-6">
          <p className="text-xs text-amber-200/80">{twin.data?.disclaimer}</p>

          <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
            <h2 className="text-sm font-medium text-cyan-400">Explicit preferences</h2>
            {twin.isLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <ul className="text-sm text-zinc-300 space-y-1">
                {((twin.data?.explicit ?? []) as { key: string; label: string; value: string }[]).map((x) => (
                  <li key={x.key}>
                    <span className="text-zinc-500">{x.label}:</span> {x.value}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-sm font-medium text-cyan-400">Inferred traits (correctable)</h2>
            {twin.isLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <ul className="space-y-3">
                {visibleInferred.map((row) => (
                  <li key={row.key} className="rounded border border-zinc-800 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-zinc-200">{row.label}</div>
                        <div className="text-zinc-400 mt-1">{row.summary}</div>
                        <div className="text-xs text-zinc-500 mt-1">
                          Confidence: {(row.confidence * 100).toFixed(0)}%
                        </div>
                        <ul className="text-xs text-zinc-500 mt-1 list-disc pl-4">
                          {row.evidence.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                        {row.userNote ? (
                          <div className="text-xs text-amber-200/90 mt-2">Your note: {row.userNote}</div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0"
                        onClick={() => toggleHide(row.key, true)}
                      >
                        Hide
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {hiddenInferred.length > 0 ? (
              <div className="pt-2 border-t border-zinc-800">
                <h3 className="text-xs uppercase text-zinc-500 mb-2">Hidden from default view</h3>
                <ul className="space-y-2">
                  {hiddenInferred.map((row) => (
                    <li key={row.key} className="flex items-center justify-between text-sm text-zinc-500">
                      <span>{row.label}</span>
                      <button
                        type="button"
                        className="text-xs text-cyan-400 hover:underline"
                        onClick={() => toggleHide(row.key, false)}
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">Trait note / override</h2>
            <select
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={noteKey}
              onChange={(e) => setNoteKey(e.target.value)}
            >
              {inferredRows.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <textarea
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm min-h-[50px]"
              placeholder="Note (shown alongside trait)"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <textarea
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm min-h-[50px]"
              placeholder="Override summary (optional — replaces inferred text)"
              value={overrideText}
              onChange={(e) => setOverrideText(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-zinc-800 px-3 py-1 text-sm"
              onClick={() => {
                patchTwin.mutate({
                  traitCorrections: {
                    [noteKey]: {
                      note: noteText || undefined,
                      overrideSummary: overrideText || undefined,
                    },
                  },
                });
              }}
            >
              Save correction
            </button>
          </section>

          <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">Purge twin memory classes</h2>
            <p className="text-xs text-zinc-500">
              Clears stored corrections and/or visibility choices — not your obligations or other core data.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-zinc-700 px-3 py-1 text-xs"
                onClick={() => purgeTwin.mutate('corrections')}
              >
                Purge corrections
              </button>
              <button
                type="button"
                className="rounded border border-zinc-700 px-3 py-1 text-xs"
                onClick={() => purgeTwin.mutate('visibility')}
              >
                Restore all hidden traits
              </button>
              <button
                type="button"
                className="rounded border border-red-900/50 px-3 py-1 text-xs text-red-300"
                onClick={() => purgeTwin.mutate('all')}
              >
                Purge all twin overlays
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'planning' ? (
        <div className="space-y-4">
          <p className="text-xs text-amber-200/80">{planning.data?.disclaimer}</p>
          {planning.isLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <ul className="space-y-3">
              {(planning.data?.cards ?? []).map((c) => (
                <li key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
                  <div className="font-medium text-zinc-100">{c.title}</div>
                  <p className="text-sm text-zinc-400">{c.rationale}</p>
                  <div className="text-xs text-zinc-500">
                    Confidence: {(c.confidence * 100).toFixed(0)}% · Timing: {c.timingNote}
                  </div>
                  <div className="text-xs text-zinc-600">
                    Factors: {c.influencingFactors.join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-zinc-500">
            Accept/dismiss for obligation-linked items stays on <Link to="/">Brief</Link> / Suggestions; these
            cards are explanatory planning context only.
          </p>
        </div>
      ) : null}
    </div>
  );
}
