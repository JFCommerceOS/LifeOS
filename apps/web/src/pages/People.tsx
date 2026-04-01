import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

type PersonRow = {
  id: string;
  name: string;
  relationshipType: string;
  importance: number;
  lastInteractionAt: string | null;
};

export default function People() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [relationshipType, setRelationshipType] = useState('');
  const [importance, setImportance] = useState(3);

  const q = useQuery({
    queryKey: ['persons'],
    queryFn: () => lifeOsApi.getPersons(1),
  });

  const create = useMutation({
    mutationFn: () =>
      lifeOsApi.postPerson({
        name: name.trim(),
        ...(relationshipType.trim() ? { relationshipType: relationshipType.trim() } : {}),
        importance,
      }),
    onSuccess: () => {
      setName('');
      setRelationshipType('');
      setImportance(3);
      void qc.invalidateQueries({ queryKey: ['persons'] });
    },
  });

  if (q.isLoading) return <p className="text-zinc-500">Loading people…</p>;
  if (q.isError) return <p className="text-red-400">{(q.error as Error).message}</p>;

  const rows = (q.data?.data ?? []) as PersonRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">People</h1>
      <p className="text-sm text-zinc-500">
        Open a person to link them to events, notes, and obligations from the person page.
      </p>

      <form
        className="flex flex-wrap gap-2 items-end rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Name</span>
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Relationship</span>
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
            placeholder="colleague"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Importance 1–5</span>
          <input
            type="number"
            min={1}
            max={5}
            className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
            value={importance}
            onChange={(e) => setImportance(Number(e.target.value))}
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending || !name.trim()}
          className="rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Add person
        </button>
      </form>
      {create.isError ? (
        <p className="text-sm text-red-400">{(create.error as Error).message}</p>
      ) : null}

      <ul className="space-y-2">
        {rows.map((p) => (
          <li key={p.id}>
            <Link
              to={`/people/${p.id}`}
              className="block rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 hover:border-zinc-600"
            >
              <div className="font-medium text-zinc-100">{p.name}</div>
              <div className="text-xs text-zinc-500">
                {p.relationshipType} · importance {p.importance}
                {p.lastInteractionAt
                  ? ` · last interaction ${new Date(p.lastInteractionAt).toLocaleDateString()}`
                  : ''}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="text-zinc-500">No people yet.</p> : null}
    </div>
  );
}
