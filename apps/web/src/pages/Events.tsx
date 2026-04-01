import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

type EventRow = {
  id: string;
  title: string;
  startsAt: string | null;
};

export default function Events() {
  const q = useQuery({
    queryKey: ['events'],
    queryFn: () => lifeOsApi.getEvents(1),
  });

  if (q.isLoading) return <p className="text-zinc-500">Loading events…</p>;
  if (q.isError) return <p className="text-red-400">{(q.error as Error).message}</p>;

  const rows = (q.data?.data ?? []) as EventRow[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Events</h1>
      <p className="text-sm text-zinc-500">
        Open an event to see prep context and link people as participants.
      </p>
      <ul className="space-y-2">
        {rows.map((e) => (
          <li key={e.id}>
            <Link
              to={`/events/${e.id}`}
              className="block rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 hover:border-zinc-600"
            >
              <div className="font-medium text-zinc-100">{e.title}</div>
              <div className="text-xs text-zinc-500">
                {e.startsAt ? new Date(e.startsAt).toLocaleString() : 'No start time'}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="text-zinc-500 text-sm">No events yet. Sync a calendar connector or add via API.</p>
      ) : null}
    </div>
  );
}
