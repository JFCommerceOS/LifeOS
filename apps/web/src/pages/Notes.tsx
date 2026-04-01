import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { EmptyState } from '../components/ui/EmptyState';
import { PriorityCard } from '../components/ui/PriorityCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

export default function Notes() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const list = useQuery({
    queryKey: ['notes'],
    queryFn: () => lifeOsApi.getNotes(1),
  });

  const create = useMutation({
    mutationFn: () => lifeOsApi.postNote({ body }),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['obligations'] });
    },
  });

  if (list.isLoading) {
    return (
      <p className={los.textMuted} role="status">
        {t('common.loading')}
      </p>
    );
  }
  if (list.isError) {
    return (
      <p className="text-red-400" role="alert">
        {formatApiError(list.error, t)}
      </p>
    );
  }

  const notes = (list.data?.data ?? []) as { id: string; body: string; title: string | null }[];

  return (
    <div className={los.page}>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">{t('notes.title')}</h1>
        <p className={`mt-2 max-w-xl text-[15px] leading-relaxed ${los.textSecondary}`}>{t('notes.tagline')}</p>
      </header>

      <section className="mb-8" aria-labelledby="capture-form">
        <SectionHeader id="capture-form" title={t('notes.newNote')} subtitle={t('notes.newNoteSubtitle')} />
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) create.mutate();
          }}
        >
          <textarea
            className={`${los.input} min-h-[120px] resize-y ${los.focusRing}`}
            placeholder={t('notes.placeholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label={t('notes.placeholder')}
          />
          <button
            type="submit"
            disabled={create.isPending || !body.trim()}
            className={`${los.btnPrimary} ${los.focusRing}`}
          >
            {t('notes.save')}
          </button>
        </form>
      </section>

      <section aria-labelledby="capture-list">
        <SectionHeader id="capture-list" title={t('notes.recent')} />
        {notes.length === 0 ? (
          <EmptyState title={t('notes.emptyTitle')} description={t('notes.emptyBody')} />
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id}>
                <PriorityCard title={n.title ?? t('notes.untitledNote')}>
                  <div className={`whitespace-pre-wrap ${los.textSecondary}`}>{n.body}</div>
                </PriorityCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
