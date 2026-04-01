import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

type SavedPlaceRow = {
  id: string;
  label: string;
  category: string | null;
  sensitivity: string;
  defaultMasked: boolean;
  aliases: { id: string; alias: string }[];
  _count?: { placeEvents: number };
};

export default function Places() {
  const qc = useQueryClient();
  const caps = useQuery({ queryKey: ['places-capabilities'], queryFn: () => lifeOsApi.getPlacesCapabilities() });
  const places = useQuery({ queryKey: ['saved-places'], queryFn: () => lifeOsApi.getSavedPlaces(1) });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => lifeOsApi.getSettings() });

  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [sensitivity, setSensitivity] = useState<'normal' | 'home' | 'work' | 'private_sensitive'>('normal');
  const [defaultMasked, setDefaultMasked] = useState(false);
  const [aliasInput, setAliasInput] = useState<Record<string, string>>({});

  const patchSettings = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchSettings(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const createPlace = useMutation({
    mutationFn: () =>
      lifeOsApi.postSavedPlace({
        label: label.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
        sensitivity,
        defaultMasked,
      }),
    onSuccess: () => {
      setLabel('');
      setCategory('');
      void qc.invalidateQueries({ queryKey: ['saved-places'] });
    },
  });

  const delPlace = useMutation({
    mutationFn: (id: string) => lifeOsApi.deleteSavedPlace(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['saved-places'] }),
  });

  const addAlias = useMutation({
    mutationFn: ({ id, alias }: { id: string; alias: string }) =>
      lifeOsApi.postSavedPlaceAlias(id, { alias }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['saved-places'] });
    },
  });

  const delAlias = useMutation({
    mutationFn: ({ placeId, aliasId }: { placeId: string; aliasId: string }) =>
      lifeOsApi.deleteSavedPlaceAlias(placeId, aliasId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['saved-places'] }),
  });

  const rows = (places.data?.data ?? []) as SavedPlaceRow[];

  const st = settings.data?.settings as { locationIntelligenceOptIn?: boolean } | undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Places</h1>
        <p className="text-sm text-slate-400">
          Saved labels for visits — no raw GPS trail. Link visits from{' '}
          <Link to="/patterns" className="text-cyan-400 underline">
            Patterns
          </Link>
          .
        </p>
      </header>

      {caps.data ? (
        <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3 text-xs text-slate-400">
          <p>{caps.data.note}</p>
          <p className="mt-1">
            Mode: <span className="text-slate-200">{caps.data.mode}</span> · Background tracking:{' '}
            {caps.data.backgroundTracking ? 'on' : 'off'}
          </p>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={st?.locationIntelligenceOptIn === true}
          onChange={(e) => patchSettings.mutate({ locationIntelligenceOptIn: e.target.checked })}
        />
        Location-linked suggestion hints (tiny rank nudge when you have recent visits)
      </label>

      <section className="space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <h2 className="text-sm font-medium text-slate-200">Add saved place</h2>
        <input
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          placeholder="Label (e.g. Grocery)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          placeholder="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <label className="block text-xs text-slate-500">
          Sensitivity
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value as typeof sensitivity)}
          >
            <option value="normal">Normal</option>
            <option value="home">Home</option>
            <option value="work">Work</option>
            <option value="private_sensitive">Private / sensitive (hidden from pattern summaries)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={defaultMasked} onChange={(e) => setDefaultMasked(e.target.checked)} />
          Default mask new visits at this place in insights
        </label>
        <button
          type="button"
          disabled={!label.trim() || createPlace.isPending}
          onClick={() => createPlace.mutate()}
          className="rounded bg-cyan-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save place
        </button>
        {createPlace.isError ? (
          <p className="text-sm text-red-400">{(createPlace.error as Error).message}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-200">Your places</h2>
        {places.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="rounded-lg border border-white/10 bg-slate-900/30 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100">{p.label}</p>
                  <p className="text-xs text-slate-500">
                    {p.sensitivity}
                    {p.defaultMasked ? ' · default masked' : ''}
                    {p._count?.placeEvents != null ? ` · ${p._count.placeEvents} visit link(s)` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => delPlace.mutate(p.id)}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Delete
                </button>
              </div>
              {p.aliases?.length ? (
                <ul className="mt-2 flex flex-wrap gap-1">
                  {p.aliases.map((a) => (
                    <li
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300"
                    >
                      {a.alias}
                      <button
                        type="button"
                        className="text-slate-500 hover:text-rose-400"
                        aria-label={`Remove alias ${a.alias}`}
                        onClick={() => delAlias.mutate({ placeId: p.id, aliasId: a.id })}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  placeholder="Add alias"
                  value={aliasInput[p.id] ?? ''}
                  onChange={(e) => setAliasInput((prev) => ({ ...prev, [p.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="rounded bg-slate-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                  disabled={!(aliasInput[p.id] ?? '').trim() || addAlias.isPending}
                  onClick={() => {
                    const a = (aliasInput[p.id] ?? '').trim();
                    if (!a) return;
                    addAlias.mutate({ id: p.id, alias: a });
                    setAliasInput((prev) => ({ ...prev, [p.id]: '' }));
                  }}
                >
                  Add
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!rows.length && !places.isLoading ? (
          <p className="text-sm text-slate-500">No saved places yet.</p>
        ) : null}
      </section>
    </div>
  );
}
