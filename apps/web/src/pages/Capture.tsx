import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

export default function Capture() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [noteBody, setNoteBody] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');

  const noteMut = useMutation({
    mutationFn: () => lifeOsApi.postNote({ body: noteBody, title: noteTitle || undefined }),
    onSuccess: () => {
      setNoteBody('');
      setNoteTitle('');
      void qc.invalidateQueries({ queryKey: ['notes'] });
      void qc.invalidateQueries({ queryKey: ['brief', 'latest'] });
      void qc.invalidateQueries({ queryKey: ['obligations'] });
      void qc.invalidateQueries({ queryKey: ['memory'] });
    },
  });

  const taskMut = useMutation({
    mutationFn: () =>
      lifeOsApi.postTask({
        title: taskTitle,
        dueAt: taskDue ? new Date(taskDue).toISOString() : null,
      }),
    onSuccess: () => {
      setTaskTitle('');
      setTaskDue('');
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['brief', 'latest'] });
      void qc.invalidateQueries({ queryKey: ['memory'] });
    },
  });

  const docMut = useMutation({
    mutationFn: (formData: FormData) => lifeOsApi.postDocumentUpload(formData),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['brief', 'latest'] });
      void qc.invalidateQueries({ queryKey: ['memory'] });
      void qc.invalidateQueries({ queryKey: ['obligations'] });
    },
  });

  const eventMut = useMutation({
    mutationFn: () =>
      lifeOsApi.postEvent({
        title: eventTitle,
        startsAt: eventStart ? new Date(eventStart).toISOString() : null,
      }),
    onSuccess: () => {
      setEventTitle('');
      setEventStart('');
      void qc.invalidateQueries({ queryKey: ['events'] });
      void qc.invalidateQueries({ queryKey: ['brief', 'latest'] });
      void qc.invalidateQueries({ queryKey: ['context-next-event'] });
      void qc.invalidateQueries({ queryKey: ['memory'] });
    },
  });

  return (
    <div className="space-y-10">
      <PageHeader title={t('capture.title')} tagline={t('capture.subtitle')} />

      <p className={`max-w-2xl text-sm ${los.textMuted}`}>
        {t('capture.loopHint')}{' '}
        <Link className="text-cyan-400/90 underline-offset-2 hover:underline" to="/">
          {t('capture.linkBrief')}
        </Link>
        {' · '}
        <Link className="text-cyan-400/90 underline-offset-2 hover:underline" to="/memory">
          {t('capture.linkMemory')}
        </Link>
        {' · '}
        <Link className="text-cyan-400/90 underline-offset-2 hover:underline" to="/settings#settings-local-assistant">
          {t('capture.linkLocalAssistant')}
        </Link>
      </p>

      <section className="grid gap-8 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#0F1624]/80 p-4">
          <SectionHeader title={t('capture.noteTitle')} subtitle={t('capture.noteSubtitle')} />
          {noteMut.isError && (
            <p className="mb-2 text-sm text-rose-300">{formatApiError(noteMut.error, t)}</p>
          )}
          <label className="mt-3 block text-xs text-slate-500">
            {t('capture.optionalTitle')}
            <input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="mt-3 block text-xs text-slate-500">
            {t('capture.body')}
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
              placeholder={t('capture.notePlaceholder')}
            />
          </label>
          <button
            type="button"
            disabled={!noteBody.trim() || noteMut.isPending}
            onClick={() => noteMut.mutate()}
            className={`mt-3 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 ${los.focusRing} disabled:opacity-40`}
          >
            {noteMut.isPending ? t('common.loading') : t('capture.saveNote')}
          </button>
          {noteMut.isSuccess && noteMut.data ? (
            <p className={`mt-3 text-xs leading-relaxed ${los.textMuted}`} role="status">
              {noteMut.data.signal.processingStatus === 'context_ready'
                ? `Structured: ${noteMut.data.facts.length} fact(s), ${noteMut.data.obligations.length} obligation(s).`
                : `Processing: ${noteMut.data.signal.processingStatus}`}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1624]/80 p-4">
          <SectionHeader title={t('capture.taskTitle')} subtitle={t('capture.taskSubtitle')} />
          {taskMut.isError && (
            <p className="mb-2 text-sm text-rose-300">{formatApiError(taskMut.error, t)}</p>
          )}
          <label className="mt-3 block text-xs text-slate-500">
            {t('capture.taskLabel')}
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="mt-3 block text-xs text-slate-500">
            {t('capture.dueOptional')}
            <input
              type="datetime-local"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <button
            type="button"
            disabled={!taskTitle.trim() || taskMut.isPending}
            onClick={() => taskMut.mutate()}
            className={`mt-3 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 ${los.focusRing} disabled:opacity-40`}
          >
            {taskMut.isPending ? t('common.loading') : t('capture.saveTask')}
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1624]/80 p-4">
          <SectionHeader title={t('capture.eventTitle')} subtitle={t('capture.eventSubtitle')} />
          {eventMut.isError && (
            <p className="mb-2 text-sm text-rose-300">{formatApiError(eventMut.error, t)}</p>
          )}
          <label className="mt-3 block text-xs text-slate-500">
            {t('capture.eventLabel')}
            <input
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="mt-3 block text-xs text-slate-500">
            {t('capture.startsOptional')}
            <input
              type="datetime-local"
              value={eventStart}
              onChange={(e) => setEventStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <button
            type="button"
            disabled={!eventTitle.trim() || eventMut.isPending}
            onClick={() => eventMut.mutate()}
            className={`mt-3 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 ${los.focusRing} disabled:opacity-40`}
          >
            {eventMut.isPending ? t('common.loading') : t('capture.saveEvent')}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0F1624]/80 p-4">
        <SectionHeader title={t('capture.docTitle')} subtitle={t('capture.docSubtitle')} />
        {docMut.isError && (
          <p className="mb-2 text-sm text-rose-300">{formatApiError(docMut.error, t)}</p>
        )}
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const el = e.currentTarget;
            const file = (el.elements.namedItem('file') as HTMLInputElement)?.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.append('file', file);
            const titleEl = el.elements.namedItem('docTitle') as HTMLInputElement;
            if (titleEl?.value?.trim()) fd.append('title', titleEl.value.trim());
            fd.append('sourceKind', 'upload');
            docMut.mutate(fd);
            el.reset();
          }}
        >
          <label className="block text-xs text-slate-500">
            {t('capture.optionalTitle')}
            <input
              name="docTitle"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block text-xs text-slate-500">
            {t('capture.docFile')}
            <input
              name="file"
              type="file"
              accept="application/pdf,image/*,text/*"
              className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-1.5 file:text-cyan-100"
              required
            />
          </label>
          <button
            type="submit"
            disabled={docMut.isPending}
            className={`rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 ${los.focusRing} disabled:opacity-40`}
          >
            {docMut.isPending ? t('common.loading') : t('capture.docUpload')}
          </button>
        </form>
        {docMut.isSuccess && docMut.data ? (
          <p className={`mt-3 text-xs ${los.textMuted}`} role="status">
            {t('capture.docDone', { id: docMut.data.documentId })}
          </p>
        ) : null}
      </section>
    </div>
  );
}
