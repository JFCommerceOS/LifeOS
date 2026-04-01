import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterChipRow } from '../components/ui/FilterChipRow';
import { PriorityCard } from '../components/ui/PriorityCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatDateTime } from '../lib/date';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

type Obligation = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  reasonSummary?: string | null;
  obligationType?: string | null;
  confidence?: number;
  createdAt?: string;
  lastSurfacedAt?: string | null;
};

type ObligationFilter = 'all' | 'replies' | 'deadlines' | 'followups' | 'admin' | 'promises';
type StatusFilter = 'all' | 'open' | 'confirmed' | 'dismissed' | 'resolved' | 'reopened';
type SortKey = 'urgency' | 'due' | 'created' | 'confidence';

const FILTER_DEFS: { id: ObligationFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'obligations.filterAll' },
  { id: 'replies', labelKey: 'obligations.filterReplies' },
  { id: 'deadlines', labelKey: 'obligations.filterDeadlines' },
  { id: 'followups', labelKey: 'obligations.filterFollowups' },
  { id: 'admin', labelKey: 'obligations.filterAdmin' },
  { id: 'promises', labelKey: 'obligations.filterPromises' },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'open', label: 'Open' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'reopened', label: 'Reopened' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'resolved', label: 'Resolved' },
];

function obligationCategory(o: Obligation): 'replies' | 'deadlines' | 'followups' | 'admin' | 'promises' | 'other' {
  const low = o.title.toLowerCase();
  if (/\b(reply|email|respond|call|message|text|write)\b/.test(low)) return 'replies';
  if (o.dueAt) return 'deadlines';
  if (/\b(follow|follow-up|follow up|waiting|check in|check-in)\b/.test(low)) return 'followups';
  if (/\b(admin|tax|renew|bill|invoice|legal|permit|deadline filing)\b/.test(low)) return 'admin';
  if (/\b(promise|committed|i will|we will|i'll|we'll)\b/.test(low)) return 'promises';
  return 'other';
}

function matchesFilter(o: Obligation, f: ObligationFilter): boolean {
  if (f === 'all') return true;
  return obligationCategory(o) === f;
}

function matchesStatus(o: Obligation, f: StatusFilter): boolean {
  if (f === 'all') return true;
  return o.status === f;
}

function sortObligations(rows: Obligation[], key: SortKey): Obligation[] {
  const copy = [...rows];
  if (key === 'due') {
    copy.sort((a, b) => {
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ad - bd;
    });
  } else if (key === 'created') {
    copy.sort((a, b) => {
      const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bc - ac;
    });
  } else if (key === 'confidence') {
    copy.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  } else {
    copy.sort((a, b) => {
      const ao = isOverdue(a) ? 0 : isDueToday(a) ? 1 : 2;
      const bo = isOverdue(b) ? 0 : isDueToday(b) ? 1 : 2;
      const u = ao - bo;
      if (u !== 0) return u;
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ad - bd;
    });
  }
  return copy;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const ACTIVE_FOR_UI = new Set(['open', 'confirmed', 'reopened']);

function isOverdue(o: Obligation): boolean {
  if (!o.dueAt || !ACTIVE_FOR_UI.has(o.status)) return false;
  return new Date(o.dueAt).getTime() < Date.now();
}

function isDueToday(o: Obligation): boolean {
  if (!o.dueAt || !ACTIVE_FOR_UI.has(o.status)) return false;
  const due = new Date(o.dueAt);
  const today = startOfLocalDay(new Date());
  const dueDay = startOfLocalDay(due);
  return dueDay.getTime() === today.getTime();
}

export default function Obligations() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ObligationFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('urgency');

  const list = useQuery({
    queryKey: ['obligations'],
    queryFn: () => lifeOsApi.getObligations(1),
  });

  const suggestionsMeta = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => lifeOsApi.getSuggestions(1),
  });

  const patch = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'dismiss' | 'resolve' }) =>
      lifeOsApi.patchObligation(id, { action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['obligations'] });
      void qc.invalidateQueries({ queryKey: ['brief'] });
    },
  });

  const rows = (list.data?.data ?? []) as Obligation[];
  const statusScoped = useMemo(
    () => rows.filter((o) => matchesStatus(o, statusFilter)),
    [rows, statusFilter],
  );
  const visible = useMemo(() => {
    const filtered = statusScoped.filter((o) => matchesFilter(o, filter));
    return sortObligations(filtered, sortKey);
  }, [statusScoped, filter, sortKey]);

  const activeRows = useMemo(() => rows.filter((o) => ACTIVE_FOR_UI.has(o.status)), [rows]);
  const overdueCount = useMemo(() => activeRows.filter(isOverdue).length, [activeRows]);
  const dueTodayCount = useMemo(() => activeRows.filter(isDueToday).length, [activeRows]);
  const needsConfirmation = (suggestionsMeta.data?.meta as { total?: number } | undefined)?.total ?? 0;

  const filterChips = useMemo(
    () => FILTER_DEFS.map((c) => ({ id: c.id, label: t(c.labelKey) })),
    [t],
  );

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

  const summary = (
    <>
      <span>
        <span className="text-slate-500">{t('obligations.summaryOverdue')}</span>{' '}
        <span className="font-medium text-slate-300">{overdueCount}</span>
      </span>
      <span>
        <span className="text-slate-500">{t('obligations.summaryDueToday')}</span>{' '}
        <span className="font-medium text-slate-300">{dueTodayCount}</span>
      </span>
      <span>
        <span className="text-slate-500">{t('obligations.summaryNeedsConfirmation')}</span>{' '}
        <span className="font-medium text-cyan-400/90">{needsConfirmation}</span>
      </span>
    </>
  );

  const mainList = (
    <>
      <div className="mb-6 space-y-4">
        <SectionHeader title={t('obligations.filterLabel')} />
        <FilterChipRow
          aria-label={t('obligations.filterLabel')}
          chips={filterChips}
          value={filter}
          onChange={setFilter}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className={`flex items-center gap-2 text-sm ${los.textSecondary}`}>
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-slate-200"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`flex items-center gap-2 text-sm ${los.textSecondary}`}>
            Sort
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-slate-200"
            >
              <option value="urgency">Urgency</option>
              <option value="due">Due date</option>
              <option value="created">Recently created</option>
              <option value="confidence">Confidence</option>
            </select>
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          variant="premium"
          title={t('obligations.emptyPremiumTitle')}
          description={t('obligations.emptyPremiumBody')}
        >
          <Link to="/notes" className={`${los.btnPrimary} inline-flex items-center justify-center no-underline`}>
            {t('obligations.captureNote')}
          </Link>
          <Link to="/" className={`${los.btnSecondary} inline-flex items-center justify-center no-underline`}>
            {t('obligations.openBrief')}
          </Link>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title={t('obligations.emptyFilter')} description={t('obligations.emptyFilterBody')} />
      ) : (
        <ul className="space-y-4">
          {visible.map((o) => (
            <li key={o.id}>
              <PriorityCard
                title={o.title}
                subtitle={
                  [
                    o.reasonSummary?.trim(),
                    o.obligationType,
                    o.status,
                    o.dueAt
                      ? t('obligations.dueLabel', {
                          when: formatDateTime(o.dueAt, i18n.language),
                        })
                      : null,
                    o.lastSurfacedAt
                      ? `Last surfaced ${formatDateTime(o.lastSurfacedAt, i18n.language)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                footer={
                  ['open', 'confirmed', 'reopened'].includes(o.status) ? (
                    <>
                      <button
                        type="button"
                        className={`${los.btnPrimary} ${los.focusRing}`}
                        onClick={() => patch.mutate({ id: o.id, action: 'confirm' })}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className={`${los.btnSecondary} ${los.focusRing}`}
                        onClick={() => patch.mutate({ id: o.id, action: 'dismiss' })}
                      >
                        {t('obligations.dismiss')}
                      </button>
                      <button
                        type="button"
                        className={`${los.btnSecondary} ${los.focusRing}`}
                        onClick={() => patch.mutate({ id: o.id, action: 'resolve' })}
                      >
                        Resolve
                      </button>
                    </>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <p className={`mt-8 text-center text-sm ${los.textMuted}`}>{t('obligations.watchLine')}</p>
      ) : null}
    </>
  );

  return (
    <div className={los.page}>
      <PageHeader title={t('obligations.title')} tagline={t('obligations.tagline')} summary={summary} />

      <div className="grid gap-8 xl:grid-cols-[1fr_280px] xl:items-start">
        <div>{mainList}</div>
        <aside className="hidden space-y-4 xl:block">
          <div className={`${los.surfaceCard} p-5`}>
            <h3 className={los.textLabel}>{t('obligations.railTitle')}</h3>
            <p className={`mt-3 text-sm leading-relaxed ${los.textSecondary}`}>{t('obligations.railBody')}</p>
            <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4 text-xs text-slate-500">
              <p>· {t('obligations.railBullet1')}</p>
              <p>· {t('obligations.railBullet2')}</p>
              <p>· {t('obligations.railBullet3')}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
