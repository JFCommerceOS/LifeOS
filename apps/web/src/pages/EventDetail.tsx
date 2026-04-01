import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { BriefObligationActions } from '../components/brief/BriefObligationActions';
import { los } from '../design/tokens';
import { lifeOsApi } from '../lib/api';

type Person = { id: string; name: string };
type Note = { id: string; title: string | null; body: string };
type Obligation = { id: string; title: string; status?: string };

export default function EventDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [participantId, setParticipantId] = useState('');

  const q = useQuery({
    queryKey: ['event', id],
    queryFn: () => lifeOsApi.getEvent(id!),
    enabled: Boolean(id),
  });

  const brief = useQuery({
    queryKey: ['event-brief', id],
    queryFn: () => lifeOsApi.getContextEventBrief(id!),
    enabled: Boolean(id),
  });

  const personsQ = useQuery({
    queryKey: ['persons'],
    queryFn: () => lifeOsApi.getPersons(1),
  });

  const recomputePrep = useMutation({
    mutationFn: () => lifeOsApi.postPrepRecomputeEvent(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['event-brief', id] });
    },
  });

  const linkParticipant = useMutation({
    mutationFn: (personId: string) =>
      lifeOsApi.postEntityLink({
        fromEntityType: 'Person',
        fromEntityId: personId,
        toEntityType: 'Event',
        toEntityId: id!,
        relationType: 'participant',
      }),
    onSuccess: () => {
      setParticipantId('');
      void qc.invalidateQueries({ queryKey: ['event-brief', id] });
    },
  });

  if (!id) return <p className="text-zinc-500">Missing id</p>;
  if (q.isLoading) return <p className="text-zinc-500">Loading…</p>;
  if (q.isError) return <p className="text-red-400">{(q.error as Error).message}</p>;

  const event = q.data?.event as {
    id: string;
    title: string;
    description: string | null;
    startsAt: string | null;
    endsAt: string | null;
  };

  const participants = (brief.data?.participants ?? []) as Person[];
  const participantIdSet = new Set(participants.map((p) => p.id));
  const allPeople = (personsQ.data?.data ?? []) as Person[];
  const canLink = allPeople.filter((p) => !participantIdSet.has(p.id));

  const priorNotes = (brief.data?.priorNotes ?? []) as Note[];
  const relatedDocuments = (brief.data?.relatedDocuments ?? []) as {
    id: string;
    title: string;
    summaryLine?: string | null;
  }[];
  const openObligations = (brief.data?.openObligations ?? []) as Obligation[];
  const prepSummary = brief.data?.prepSummary ?? '';
  const lastDiscussed = brief.data?.lastDiscussed as {
    title: string | null;
    summary: string | null;
    occurredAt: string;
    person?: { name: string } | null;
  } | null;

  return (
    <div className={`${los.page} space-y-6`}>
      <div className="flex gap-3 text-sm">
        <Link to="/" className={los.accentLink}>
          ← Brief
        </Link>
        <Link to="/events" className={los.accentLink}>
          All events
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-50">{event.title}</h1>
        <button
          type="button"
          disabled={recomputePrep.isPending}
          onClick={() => recomputePrep.mutate()}
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Recompute prep bundle
        </button>
      </div>
      {event.description ? <p className="text-zinc-300">{event.description}</p> : null}
      <p className="text-sm text-zinc-500">
        {event.startsAt ? `Starts: ${new Date(event.startsAt).toLocaleString()}` : 'No start time'}
      </p>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Link a participant</h2>
        <p className="text-xs text-zinc-500">
          Creates Person → Event with <code className="text-cyan-400">participant</code>.
        </p>
        {personsQ.isLoading ? (
          <p className="text-sm text-zinc-500">Loading people…</p>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 min-w-[12rem]"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
            >
              <option value="">Select person…</option>
              {canLink.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!participantId || linkParticipant.isPending}
              onClick={() => linkParticipant.mutate(participantId)}
              className="rounded bg-cyan-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Add participant
            </button>
          </div>
        )}
        {canLink.length === 0 && allPeople.length > 0 ? (
          <p className="text-xs text-zinc-500">Everyone is already linked to this event.</p>
        ) : null}
        {allPeople.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Add people under <Link to="/people" className="text-cyan-400 underline">People</Link> first.
          </p>
        ) : null}
        {linkParticipant.isError ? (
          <p className="text-xs text-red-400">{(linkParticipant.error as Error).message}</p>
        ) : null}
      </section>

      {brief.isLoading ? (
        <p className="text-sm text-zinc-500">Loading context…</p>
      ) : brief.isError ? (
        <p className="text-sm text-red-400">{(brief.error as Error).message}</p>
      ) : (
        <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-cyan-400">Meeting prep</h2>
          <p className="text-sm text-zinc-300">{prepSummary}</p>

          {participants.length > 0 ? (
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Participants</h3>
              <ul className="mt-1 flex flex-wrap gap-2">
                {participants.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/people/${p.id}`}
                      className="text-sm text-cyan-400 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No participants linked yet.</p>
          )}

          {lastDiscussed ? (
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Last discussed</h3>
              <p className="text-sm text-zinc-400">
                {new Date(lastDiscussed.occurredAt).toLocaleString()}
                {lastDiscussed.person?.name ? ` · ${lastDiscussed.person.name}` : ''}
              </p>
              {lastDiscussed.title ? (
                <p className="text-sm text-zinc-200">{lastDiscussed.title}</p>
              ) : null}
              {lastDiscussed.summary ? (
                <p className="text-sm text-zinc-500">{lastDiscussed.summary}</p>
              ) : null}
            </div>
          ) : null}

          {priorNotes.length > 0 ? (
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Prior notes</h3>
              <ul className="mt-1 space-y-1">
                {priorNotes.map((n) => (
                  <li key={n.id} className="text-sm text-zinc-300">
                    {n.title ?? n.body.slice(0, 120)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {relatedDocuments.length > 0 ? (
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Related documents</h3>
              <ul className="mt-1 space-y-1">
                {relatedDocuments.map((d) => (
                  <li key={d.id} className="text-sm text-zinc-300">
                    <Link to={`/documents/${d.id}`} className="text-cyan-400 hover:underline">
                      {d.title}
                    </Link>
                    {d.summaryLine ? (
                      <span className="block text-xs text-zinc-500">{d.summaryLine}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {openObligations.length > 0 ? (
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Open obligations</h3>
              <ul className="mt-2 space-y-3">
                {openObligations.map((o) => (
                  <li key={o.id} className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                    <p className="text-sm text-zinc-200">{o.title}</p>
                    {o.status === 'open' || o.status === 'confirmed' || o.status === 'reopened' || !o.status ? (
                      <div className="mt-2">
                        <BriefObligationActions obligationId={o.id} surface="EVENT_DETAIL" />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
