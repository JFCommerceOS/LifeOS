import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { los } from '../../design/tokens';
import { formatApiError } from '../../lib/format-api-error';
import { lifeOsApi } from '../../lib/api';

type Tab = 'note' | 'task' | 'event' | 'doc';

export default function QuickCaptureSheet() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('note');
  const [noteBody, setNoteBody] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const noteMu = useMutation({
    mutationFn: () => lifeOsApi.postMobileCaptureNote({ body: noteBody, title: noteTitle || undefined }),
  });
  const taskMu = useMutation({
    mutationFn: () => lifeOsApi.postMobileCaptureTask({ title: taskTitle }),
  });
  const eventMu = useMutation({
    mutationFn: () => lifeOsApi.postMobileCaptureEvent({ title: eventTitle }),
  });
  const docMu = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file');
      const fd = new FormData();
      fd.append('file', file);
      fd.set('sourceKind', 'camera');
      return lifeOsApi.postMobileCaptureDocument(fd);
    },
  });

  const busy = noteMu.isPending || taskMu.isPending || eventMu.isPending || docMu.isPending;
  const err =
    noteMu.error || taskMu.error || eventMu.error || docMu.error
      ? formatApiError(noteMu.error || taskMu.error || eventMu.error || docMu.error, t)
      : null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'note') noteMu.mutate();
    if (tab === 'task') taskMu.mutate();
    if (tab === 'event') eventMu.mutate();
    if (tab === 'doc') docMu.mutate();
  };

  const success = noteMu.isSuccess || taskMu.isSuccess || eventMu.isSuccess || docMu.isSuccess;

  return (
    <div className="space-y-4">
      <Link to="/m" className={`text-sm ${los.accentLink}`}>
        ← {t('mobile.briefTitle')}
      </Link>
      <h2 className={`text-lg font-semibold ${los.textPrimary}`}>{t('mobile.captureTitle')}</h2>

      <div className="flex flex-wrap gap-2">
        {(['note', 'task', 'event', 'doc'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === k ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/5 text-slate-400'
            } ${los.focusRing}`}
          >
            {k === 'doc' ? t('mobile.takePhotoDoc') : k}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {tab === 'note' ? (
          <>
            <input
              className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm ${los.textPrimary}`}
              placeholder={t('capture.optionalTitle')}
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <textarea
              required
              className={`min-h-[120px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm ${los.textPrimary}`}
              placeholder={t('mobile.notePlaceholder')}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
          </>
        ) : null}
        {tab === 'task' ? (
          <input
            required
            className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm ${los.textPrimary}`}
            placeholder={t('mobile.taskPlaceholder')}
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
        ) : null}
        {tab === 'event' ? (
          <input
            required
            className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm ${los.textPrimary}`}
            placeholder={t('mobile.eventTitle')}
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
          />
        ) : null}
        {tab === 'doc' ? (
          <input
            type="file"
            accept="image/*,application/pdf"
            aria-label={t('capture.docFile')}
            className={`text-sm ${los.textSecondary}`}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        ) : null}

        <button
          type="submit"
          disabled={busy || (tab === 'doc' && !file)}
          className={`w-full rounded-lg bg-cyan-500/25 py-3 text-sm font-medium text-cyan-100 ${los.focusRing} disabled:opacity-40`}
        >
          {t('mobile.save')}
        </button>
      </form>

      {err ? <p className="text-rose-300">{err}</p> : null}
      {success ? (
        <p className={`text-sm ${los.textSecondary}`}>
          Saved. Same pipeline as desktop — check Brief and Memory.
        </p>
      ) : null}
    </div>
  );
}
