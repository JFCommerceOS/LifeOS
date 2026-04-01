import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { lifeOsApi } from '../lib/api';

type EventRow = { id: string; title: string };
type NoteRow = { id: string; title: string | null; body: string };
type ObligationRow = { id: string; title: string };

type Person = {
  id: string;
  name: string;
  relationshipType: string;
  importance: number;
  aliases?: { id: string; aliasText: string }[];
  personType?: string;
  importanceLevel?: string;
  notesSummary?: string | null;
};

export default function PersonDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [relType, setRelType] = useState('');
  const [imp, setImp] = useState(3);
  const [linkEventId, setLinkEventId] = useState('');
  const [linkNoteId, setLinkNoteId] = useState('');
  const [linkObligationId, setLinkObligationId] = useState('');

  const card = useQuery({
    queryKey: ['person-card', id],
    queryFn: () => lifeOsApi.getContextPersonCard(id!),
    enabled: Boolean(id),
  });

  const personRow = useQuery({
    queryKey: ['person', 'detail', id],
    queryFn: () => lifeOsApi.getPerson(id!),
    enabled: Boolean(id),
  });

  const person = card.data?.person as Person | undefined;
  const personWithAliases = (personRow.data?.person as Person | undefined) ?? person;
  useEffect(() => {
    if (personWithAliases) {
      setRelType(personWithAliases.relationshipType);
      setImp(personWithAliases.importance);
    }
  }, [personWithAliases?.id, personWithAliases?.relationshipType, personWithAliases?.importance]);

  const eventsQ = useQuery({
    queryKey: ['events'],
    queryFn: () => lifeOsApi.getEvents(1),
  });
  const notesQ = useQuery({
    queryKey: ['notes'],
    queryFn: () => lifeOsApi.getNotes(1),
  });
  const obligationsQ = useQuery({
    queryKey: ['obligations'],
    queryFn: () => lifeOsApi.getObligations(1),
  });

  const patch = useMutation({
    mutationFn: () =>
      lifeOsApi.patchPerson(id!, {
        relationshipType: relType || undefined,
        importance: imp,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['person-card', id] });
      void qc.invalidateQueries({ queryKey: ['persons'] });
    },
  });

  const linkToEvent = useMutation({
    mutationFn: () =>
      lifeOsApi.postEntityLink({
        fromEntityType: 'Person',
        fromEntityId: id!,
        toEntityType: 'Event',
        toEntityId: linkEventId,
        relationType: 'participant',
      }),
    onSuccess: () => {
      setLinkEventId('');
      void qc.invalidateQueries({ queryKey: ['person-card', id] });
      void qc.invalidateQueries({ queryKey: ['event-brief'] });
    },
  });

  const linkToNote = useMutation({
    mutationFn: () =>
      lifeOsApi.postEntityLink({
        fromEntityType: 'Person',
        fromEntityId: id!,
        toEntityType: 'Note',
        toEntityId: linkNoteId,
        relationType: 'mentioned',
      }),
    onSuccess: () => {
      setLinkNoteId('');
      void qc.invalidateQueries({ queryKey: ['person-card', id] });
    },
  });

  const [correctionNote, setCorrectionNote] = useState('');

  const correctPerson = useMutation({
    mutationFn: () =>
      lifeOsApi.postPersonCorrect(id!, {
        correctionType: 'WRONG_PERSON_MATCH',
        correctionNote: correctionNote.trim() || undefined,
      }),
    onSuccess: () => {
      setCorrectionNote('');
      void qc.invalidateQueries({ queryKey: ['person', 'detail', id] });
      void qc.invalidateQueries({ queryKey: ['person-card', id] });
    },
  });

  const linkToObligation = useMutation({
    mutationFn: () =>
      lifeOsApi.postEntityLink({
        fromEntityType: 'Person',
        fromEntityId: id!,
        toEntityType: 'Obligation',
        toEntityId: linkObligationId,
        relationType: 'about',
      }),
    onSuccess: () => {
      setLinkObligationId('');
      void qc.invalidateQueries({ queryKey: ['person-card', id] });
    },
  });

  if (!id) return <p className="text-zinc-500">Missing id</p>;
  if (card.isLoading || personRow.isLoading) return <p className="text-zinc-500">Loading…</p>;
  if (card.isError) return <p className="text-red-400">{(card.error as Error).message}</p>;

  const openObligations = (card.data?.openObligations ?? []) as { id: string; title: string }[];
  const linkedNotes = (card.data?.linkedNotes ?? []) as { id: string; title: string | null; body: string }[];
  const conversations = (card.data?.conversations ?? []) as {
    id: string;
    title: string | null;
    summary: string | null;
    occurredAt: string;
  }[];

  if (!personWithAliases) return <p className="text-zinc-500">Not found.</p>;

  const aliases = personWithAliases.aliases ?? [];

  return (
    <div className="space-y-6">
      <Link to="/people" className="text-sm text-cyan-400 hover:underline">
        ← People
      </Link>
      <h1 className="text-xl font-semibold">{personWithAliases.name}</h1>
      {personWithAliases.notesSummary ? (
        <p className="text-sm text-zinc-400 max-w-xl">{personWithAliases.notesSummary}</p>
      ) : null}
      {aliases.length > 0 ? (
        <p className="text-xs text-zinc-500">
          Aliases:{' '}
          {aliases.map((a) => (
            <span key={a.id} className="mr-2 rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
              {a.aliasText}
            </span>
          ))}
        </p>
      ) : null}
      {(personWithAliases.personType || personWithAliases.importanceLevel) && (
        <p className="text-xs text-zinc-500">
          {personWithAliases.personType ? `Type: ${personWithAliases.personType}` : ''}
          {personWithAliases.importanceLevel
            ? ` · Level: ${personWithAliases.importanceLevel}`
            : ''}
        </p>
      )}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Edit relationship</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">Type</span>
            <input
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
              value={relType}
              onChange={(e) => setRelType(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">Importance</span>
            <input
              type="number"
              min={1}
              max={5}
              className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
              value={imp}
              onChange={(e) => setImp(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={() => patch.mutate()}
            disabled={patch.isPending}
            className="rounded bg-cyan-600 px-3 py-1.5 text-sm text-white"
          >
            Save
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Correction (CTX)</h2>
        <p className="text-xs text-zinc-500">
          Log a wrong match or rename request. Life OS stores this for audit and refreshes context bundles.
        </p>
        <textarea
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          rows={3}
          placeholder="What should change?"
          value={correctionNote}
          onChange={(e) => setCorrectionNote(e.target.value)}
        />
        <button
          type="button"
          disabled={correctPerson.isPending}
          onClick={() => correctPerson.mutate()}
          className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Submit correction
        </button>
        {correctPerson.isError ? (
          <p className="text-xs text-red-400">{(correctPerson.error as Error).message}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">Link to entity</h2>
        <p className="text-xs text-zinc-500">
          Creates Person → Event / Note / Obligation edges. Use <code className="text-cyan-400">participant</code>,{' '}
          <code className="text-cyan-400">mentioned</code>, <code className="text-cyan-400">about</code>.
        </p>

        <div className="space-y-2">
          <div className="text-xs uppercase text-zinc-500">Event</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 min-w-[12rem]"
              value={linkEventId}
              onChange={(e) => setLinkEventId(e.target.value)}
            >
              <option value="">Select event…</option>
              {(eventsQ.data?.data as EventRow[] | undefined)?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!linkEventId || linkToEvent.isPending}
              onClick={() => linkToEvent.mutate()}
              className="rounded bg-cyan-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Link
            </button>
          </div>
          {linkToEvent.isError ? (
            <p className="text-xs text-red-400">{(linkToEvent.error as Error).message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase text-zinc-500">Note</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 min-w-[12rem]"
              value={linkNoteId}
              onChange={(e) => setLinkNoteId(e.target.value)}
            >
              <option value="">Select note…</option>
              {(notesQ.data?.data as NoteRow[] | undefined)?.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title ?? n.body.slice(0, 48)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!linkNoteId || linkToNote.isPending}
              onClick={() => linkToNote.mutate()}
              className="rounded bg-cyan-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Link
            </button>
          </div>
          {linkToNote.isError ? (
            <p className="text-xs text-red-400">{(linkToNote.error as Error).message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase text-zinc-500">Obligation</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 min-w-[12rem]"
              value={linkObligationId}
              onChange={(e) => setLinkObligationId(e.target.value)}
            >
              <option value="">Select obligation…</option>
              {(obligationsQ.data?.data as ObligationRow[] | undefined)?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!linkObligationId || linkToObligation.isPending}
              onClick={() => linkToObligation.mutate()}
              className="rounded bg-cyan-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Link
            </button>
          </div>
          {linkToObligation.isError ? (
            <p className="text-xs text-red-400">{(linkToObligation.error as Error).message}</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Open obligations</h2>
        {openObligations.length === 0 ? (
          <p className="text-sm text-zinc-500">None linked yet — use “Link to entity” above.</p>
        ) : (
          <ul className="space-y-1">
            {openObligations.map((o) => (
              <li key={o.id} className="text-sm text-zinc-200">
                {o.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Linked notes</h2>
        {linkedNotes.length === 0 ? (
          <p className="text-sm text-zinc-500">None linked — use “Link to entity” above.</p>
        ) : (
          <ul className="space-y-1">
            {linkedNotes.map((n) => (
              <li key={n.id} className="text-sm text-zinc-300">
                {n.title ?? n.body.slice(0, 80)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Conversations</h2>
        {conversations.length === 0 ? (
          <p className="text-sm text-zinc-500">No conversations logged.</p>
        ) : (
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id} className="text-sm border-l-2 border-zinc-700 pl-2">
                <div className="text-zinc-400">{new Date(c.occurredAt).toLocaleString()}</div>
                {c.title ? <div className="text-zinc-200">{c.title}</div> : null}
                {c.summary ? <div className="text-zinc-500">{c.summary}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
