import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

type Tab = 'lifestyle' | 'routine' | 'decisions' | 'errands';

export default function LifeFlow() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('lifestyle');
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => lifeOsApi.getSettings() });
  const lifestyle = useQuery({
    queryKey: ['insights-lifestyle'],
    queryFn: () => lifeOsApi.getInsightsLifestyle(),
    enabled: tab === 'lifestyle',
  });
  const routine = useQuery({
    queryKey: ['insights-routine'],
    queryFn: () => lifeOsApi.getInsightsRoutine(),
    enabled: tab === 'routine',
  });
  const decisions = useQuery({
    queryKey: ['decisions'],
    queryFn: () => lifeOsApi.getDecisions(1),
    enabled: tab === 'decisions',
  });
  const errands = useQuery({
    queryKey: ['errands-groups'],
    queryFn: () => lifeOsApi.getErrandsGroups(),
    enabled: tab === 'errands',
  });
  const errandWindow = useQuery({
    queryKey: ['errands-window'],
    queryFn: () => lifeOsApi.getErrandsWindow(),
    enabled: tab === 'errands',
  });
  const tasks = useQuery({
    queryKey: ['tasks'],
    queryFn: () => lifeOsApi.getTasks(1),
    enabled: tab === 'errands',
  });

  const patchSettings = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchSettings(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['insights-lifestyle'] });
      void qc.invalidateQueries({ queryKey: ['insights-routine'] });
    },
  });

  const [dTitle, setDTitle] = useState('Renew library card');
  const [dRationale, setDRationale] = useState('Shorter line on weekends.');
  const [dTopic, setDTopic] = useState('errands-library');
  const [dOutcome, setDOutcome] = useState('');

  const [similarNote, setSimilarNote] = useState<string | null>(null);

  const postDecision = useMutation({
    mutationFn: () =>
      lifeOsApi.postDecision({
        title: dTitle,
        rationale: dRationale || undefined,
        topicKey: dTopic || undefined,
        outcomeNote: dOutcome || undefined,
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['decisions'] });
      setSimilarNote(
        data.similarPrior.length > 0
          ? `${data.similarPrior.length} prior decision(s) with the same topic key.`
          : null,
      );
    },
  });

  const deleteDecision = useMutation({
    mutationFn: (id: string) => lifeOsApi.deleteDecision(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['decisions'] }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editRationale, setEditRationale] = useState('');
  const [editOutcome, setEditOutcome] = useState('');
  const [editTopic, setEditTopic] = useState('');

  const patchDecision = useMutation({
    mutationFn: (id: string) =>
      lifeOsApi.patchDecision(id, {
        title: editTitle,
        rationale: editRationale || null,
        outcomeNote: editOutcome || null,
        topicKey: editTopic || null,
      }),
    onSuccess: () => {
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ['decisions'] });
    },
  });

  const [tTitle, setTTitle] = useState('Pick up dry cleaning');
  const [tHint, setTHint] = useState('Main St');
  const [tDue, setTDue] = useState('');

  const postTask = useMutation({
    mutationFn: () =>
      lifeOsApi.postTask({
        title: tTitle,
        locationHint: tHint || undefined,
        dueAt: tDue ? new Date(tDue).toISOString() : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['errands-groups'] });
    },
  });

  const st = settings.data?.settings as { lifestyleInsightsOptIn?: boolean } | undefined;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'lifestyle', label: 'Lifestyle' },
    { id: 'routine', label: 'Routine' },
    { id: 'decisions', label: 'Decisions' },
    { id: 'errands', label: 'Errands' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Life flow</h1>
        <Link to="/settings" className="text-sm text-cyan-400 hover:underline">
          Settings
        </Link>
      </div>
      <p className="text-sm text-zinc-500">
        Phase 5 — lifestyle support (non-medical), decision memory, and errand grouping. Enable insights below
        or in Settings.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(st?.lifestyleInsightsOptIn)}
          onChange={(e) => patchSettings.mutate({ lifestyleInsightsOptIn: e.target.checked })}
        />
        Lifestyle &amp; routine insights
      </label>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`rounded px-3 py-1 text-sm ${
              tab === x.id ? 'bg-cyan-950/40 text-cyan-300' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'lifestyle' ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <p className="text-xs text-amber-200/80">{lifestyle.data?.disclaimer}</p>
          {lifestyle.isLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-medium text-cyan-400">Workload</h2>
                <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                  {(lifestyle.data?.workloadHints ?? []).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-sm font-medium text-cyan-400">Balance</h2>
                <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                  {(lifestyle.data?.balanceHints ?? []).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-sm font-medium text-cyan-400">Dining / activity (light)</h2>
                <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                  {(lifestyle.data?.diningActivityHints ?? []).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === 'routine' ? (
        <section className="rounded-lg border border-zinc-800 p-4 space-y-3">
          <p className="text-xs text-amber-200/80">{routine.data?.disclaimer}</p>
          {routine.isLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-medium text-zinc-400">Consistency</h2>
                <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                  {(routine.data?.consistencyHints ?? []).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-sm font-medium text-zinc-400">Drift</h2>
                <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                  {(routine.data?.driftHints ?? []).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <p className="text-xs text-zinc-500">
            Uses summarized screen-time and place labels from the{' '}
            <Link className="text-cyan-400 underline" to="/patterns">
              Patterns
            </Link>{' '}
            flow when you have logged data.
          </p>
        </section>
      ) : null}

      {tab === 'decisions' ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">Add decision</h2>
            <input
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={dTitle}
              onChange={(e) => setDTitle(e.target.value)}
              placeholder="Title"
            />
            <textarea
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm min-h-[60px]"
              value={dRationale}
              onChange={(e) => setDRationale(e.target.value)}
              placeholder="Rationale (optional)"
            />
            <input
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={dTopic}
              onChange={(e) => setDTopic(e.target.value)}
              placeholder="Topic key — same key links similar past decisions"
            />
            <textarea
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm min-h-[50px]"
              value={dOutcome}
              onChange={(e) => setDOutcome(e.target.value)}
              placeholder="Outcome note (optional)"
            />
            <button
              type="button"
              className="rounded bg-cyan-800/50 px-3 py-1 text-sm"
              onClick={() => postDecision.mutate()}
            >
              Save decision
            </button>
            {similarNote ? <p className="text-xs text-amber-200/90">{similarNote}</p> : null}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">History</h2>
            {decisions.isLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <ul className="space-y-2">
                {(
                  (decisions.data?.data ?? []) as {
                    id: string;
                    title: string;
                    topicKey: string | null;
                    rationale: string | null;
                    outcomeNote: string | null;
                  }[]
                ).map((row) => (
                  <li key={row.id} className="rounded border border-zinc-800 px-3 py-2 text-sm space-y-2">
                    {editingId === row.id ? (
                      <div className="space-y-2">
                        <input
                          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                        <textarea
                          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm min-h-[50px]"
                          value={editRationale}
                          onChange={(e) => setEditRationale(e.target.value)}
                          placeholder="Rationale"
                        />
                        <input
                          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
                          value={editTopic}
                          onChange={(e) => setEditTopic(e.target.value)}
                          placeholder="Topic key"
                        />
                        <textarea
                          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm min-h-[40px]"
                          value={editOutcome}
                          onChange={(e) => setEditOutcome(e.target.value)}
                          placeholder="Outcome note"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs text-cyan-400 hover:underline"
                            onClick={() => patchDecision.mutate(row.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-xs text-zinc-500 hover:underline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-zinc-200">{row.title}</div>
                          {row.topicKey ? (
                            <div className="text-xs text-zinc-500">topic: {row.topicKey}</div>
                          ) : null}
                          {row.rationale ? (
                            <div className="text-xs text-zinc-400 mt-1">{row.rationale}</div>
                          ) : null}
                          {row.outcomeNote ? (
                            <div className="text-xs text-zinc-500 mt-1">Outcome: {row.outcomeNote}</div>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            className="text-xs text-cyan-400 hover:underline"
                            onClick={() => {
                              setEditingId(row.id);
                              setEditTitle(row.title);
                              setEditRationale(row.rationale ?? '');
                              setEditTopic(row.topicKey ?? '');
                              setEditOutcome(row.outcomeNote ?? '');
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-400 hover:underline"
                            onClick={() => deleteDecision.mutate(row.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'errands' ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">Suggested action windows</h2>
            {errandWindow.isLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <>
                <ul className="list-disc pl-5 text-sm text-zinc-300">
                  {(errandWindow.data?.preferredWindows ?? []).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <p className="text-xs text-zinc-500">{errandWindow.data?.rationale}</p>
              </>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-sm font-medium text-cyan-400">Grouped by location hint</h2>
            <p className="text-xs text-zinc-500">{errands.data?.note}</p>
            {errands.isLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <ul className="space-y-3">
                {(errands.data?.groups ?? []).map((g) => (
                  <li key={g.locationHint} className="rounded border border-zinc-800 p-3">
                    <div className="text-sm font-medium text-zinc-200">{g.locationHint}</div>
                    <ol className="list-decimal pl-5 text-sm text-zinc-400 mt-1 space-y-0.5">
                      {g.suggestedSequence.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">Add task (with location hint)</h2>
            <input
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
            />
            <input
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={tHint}
              onChange={(e) => setTHint(e.target.value)}
              placeholder="Location hint — same hint groups errands"
            />
            <input
              type="datetime-local"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={tDue}
              onChange={(e) => setTDue(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-zinc-800 px-3 py-1 text-sm"
              onClick={() => postTask.mutate()}
            >
              Add task
            </button>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-400 mb-2">Open tasks (sample)</h2>
            <ul className="text-sm text-zinc-400 space-y-1">
              {((tasks.data?.data ?? []) as { id: string; title: string; locationHint: string | null }[])
                .slice(0, 8)
                .map((t) => (
                  <li key={t.id}>
                    {t.title}
                    {t.locationHint ? <span className="text-zinc-600"> — {t.locationHint}</span> : null}
                  </li>
                ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
