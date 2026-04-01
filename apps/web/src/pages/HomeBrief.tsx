import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BriefItemExplain } from '../components/brief/BriefItemExplain';
import { BriefObligationActions } from '../components/brief/BriefObligationActions';
import { BriefSuggestionActions } from '../components/brief/BriefSuggestionActions';
import { ConfidencePill } from '../components/brief/ConfidencePill';
import { EmptyState } from '../components/ui/EmptyState';
import { PriorityCard } from '../components/ui/PriorityCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatBriefDay } from '../lib/date';
import { daysSinceIso } from '../lib/everyone-advanced-gate';
import { formatApiError } from '../lib/format-api-error';
import {
  type ObligationBriefAdaptationPayload,
  formatAdaptationExplanation,
  lifeModeLabel,
} from '../lib/brief-adaptation-i18n';
import { formatBriefReasonSummary } from '../lib/brief-reason';
import { lifeOsApi } from '../lib/api';

type BriefItem = {
  id: string;
  title: string;
  bucket: string;
  oneLine?: string | null;
  reasonSummary?: string | null;
  evidenceCount?: number | null;
  priorityScore?: number | null;
  refType?: string | null;
  refId?: string | null;
  mediationReasonKey?: string | null;
  mediationToneKey?: string | null;
};

function BriefEventPrepExtras({ item }: { item: BriefItem }) {
  const { t } = useTranslation();
  const prep = useQuery({
    queryKey: ['prep', 'event', item.refId],
    queryFn: () => lifeOsApi.getPrepEvent(item.refId!),
    enabled: item.refType === 'Event' && Boolean(item.refId),
  });
  if (item.refType !== 'Event' || !item.refId) return null;
  if (prep.isLoading) {
    return <p className={`text-xs ${los.textMuted}`}>{t('brief.prepLoading')}</p>;
  }
  if (prep.isError || !prep.data) return null;
  const p = prep.data.prep as {
    topPrepLine?: string;
    linkedPersonNames?: string[];
    openObligationCount?: number;
    confidence?: number;
  };
  const names = (p.linkedPersonNames ?? []).join(', ');
  return (
    <div className={`mt-2 space-y-1 border-t border-white/10 pt-2 text-xs ${los.textSecondary}`}>
      {names ? (
        <p>
          <span className="text-slate-500">{t('brief.prepPeople')} </span>
          {names}
        </p>
      ) : null}
      {p.openObligationCount != null ? (
        <p>
          <span className="text-slate-500">{t('brief.prepOpenFollowUps')} </span>
          {p.openObligationCount}
        </p>
      ) : null}
      {p.topPrepLine ? (
        <p className="text-slate-300/95">
          <span className="text-slate-500">{t('brief.prepTop')} </span>
          {String(p.topPrepLine).slice(0, 220)}
        </p>
      ) : null}
      <Link className={`inline-block ${los.accentLink}`} to={`/events/${item.refId}`}>
        {t('brief.prepOpenEvent')}
      </Link>
    </div>
  );
}

type Brief = {
  id: string;
  day: string;
  items: BriefItem[];
};

const BUCKET_ORDER = [
  'do_now',
  'before_meeting',
  'do_today',
  'watch_week',
  'needs_confirmation',
] as const;

const BUCKET_LABEL: Record<string, string> = {
  do_now: 'brief.bucketDoNow',
  before_meeting: 'brief.bucketBeforeMeeting',
  do_today: 'brief.bucketDoToday',
  watch_week: 'brief.bucketWatchWeek',
  needs_confirmation: 'brief.bucketNeedsConfirmation',
};

function bucketRank(bucket: string): number {
  const i = BUCKET_ORDER.indexOf(bucket as (typeof BUCKET_ORDER)[number]);
  return i === -1 ? 99 : i;
}

function groupByBucket(items: BriefItem[]): Map<string, BriefItem[]> {
  const m = new Map<string, BriefItem[]>();
  for (const it of items) {
    const list = m.get(it.bucket) ?? [];
    list.push(it);
    m.set(it.bucket, list);
  }
  return m;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function HomeBrief() {
  const { t, i18n } = useTranslation();
  const [showAllByBucket, setShowAllByBucket] = useState<Record<string, boolean>>({});

  const q = useQuery({
    queryKey: ['brief', 'today'],
    queryFn: () => lifeOsApi.getTodayBrief({ explainAdaptation: true }),
  });

  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => lifeOsApi.getSettings(),
    staleTime: 60_000,
  });

  const obQ = useQuery({
    queryKey: ['obligations'],
    queryFn: () => lifeOsApi.getObligations(1),
  });

  const nextEventQ = useQuery({
    queryKey: ['context-next-event'],
    queryFn: () => lifeOsApi.getContextNextEvent(),
  });

  const sugQ = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => lifeOsApi.getSuggestions(1),
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('brief.greetingMorning');
    if (h < 17) return t('brief.greetingAfternoon');
    return t('brief.greetingEvening');
  };

  const itemSubtitle = (item: BriefItem): string | undefined => {
    const rs = item.reasonSummary;
    const opt = { mediationReasonKey: item.mediationReasonKey, mediationToneKey: item.mediationToneKey };
    if (item.mediationReasonKey) {
      return formatBriefReasonSummary(rs ?? item.oneLine ?? '', t, opt);
    }
    if (rs != null && String(rs).trim()) {
      return formatBriefReasonSummary(rs, t);
    }
    if (item.oneLine != null && String(item.oneLine).trim()) {
      return String(item.oneLine);
    }
    return undefined;
  };

  const adaptByItem = q.data?.adaptationExplanationByItemId as
    | Record<string, ObligationBriefAdaptationPayload>
    | undefined;

  const adaptationExplanation = (itemId: string): string | undefined => {
    const p = adaptByItem?.[itemId];
    if (!p) return undefined;
    return formatAdaptationExplanation(t, p);
  };

  const settings = settingsQ.data?.settings as
    | { everyoneModeEnabled?: boolean; onboardingCompletedAt?: string | null }
    | undefined;
  const everyoneMode = settings?.everyoneModeEnabled !== false;
  const onboardingAt = settings?.onboardingCompletedAt ?? null;
  const lightHome =
    everyoneMode && (onboardingAt == null || daysSinceIso(onboardingAt) < 7);
  const showOnboardingBanner = everyoneMode && onboardingAt == null;

  const itemLinks = (item: BriefItem) => {
    const links: { label: string; to: string }[] = [];
    if (item.refType === 'Obligation' && item.refId) {
      links.push({ label: t('brief.linkObligation'), to: '/obligations' });
    }
    if (item.refType === 'Event' && item.refId) {
      links.push({ label: t('brief.linkEvent'), to: `/events/${item.refId}` });
    }
    if (item.refType === 'Suggestion' && item.refId) {
      links.push({ label: t('brief.linkSuggestion'), to: '/suggestions' });
    }
    return links;
  };

  const itemFooter = (item: BriefItem) => {
    const links = itemLinks(item);
    const showSuggestionActions = item.refType === 'Suggestion' && item.refId;
    const showObligationActions = item.refType === 'Obligation' && item.refId;

    return (
      <div className="flex w-full flex-col gap-3">
        {item.bucket === 'before_meeting' && item.refType === 'Event' ? <BriefEventPrepExtras item={item} /> : null}
        <BriefItemExplain itemId={item.id} />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <ConfidencePill
          confidence={
            item.priorityScore != null
              ? item.priorityScore > 1
                ? Math.min(1, item.priorityScore / 100)
                : item.priorityScore
              : null
          }
          evidenceCount={item.evidenceCount ?? null}
        />
        {showSuggestionActions ? (
          <BriefSuggestionActions suggestionId={item.refId!} surface="DAILY_BRIEF" />
        ) : null}
        {showObligationActions ? (
          <BriefObligationActions obligationId={item.refId!} surface="DAILY_BRIEF" />
        ) : null}
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {links.map((l) => (
              <Link key={l.to} className={`text-sm ${los.accentLink}`} to={l.to}>
                {l.label}
              </Link>
            ))}
          </div>
        ) : null}
        </div>
      </div>
    );
  };

  if (q.isLoading) {
    return (
      <div className={los.page}>
        <p className={los.textMuted} role="status">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  const brief = (q.data?.brief as Brief | null) ?? null;
  const briefApiError = q.isError ? formatApiError(q.error, t) : null;

  const apiErrorBanner = briefApiError ? (
    <div
      role="alert"
      className={`mb-6 rounded-lg border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-sm leading-relaxed text-amber-100/95`}
    >
      {briefApiError}
    </div>
  ) : null;
  const activeStatuses = new Set(['open', 'confirmed', 'reopened']);
  const openObCount =
    (obQ.data?.data as { status?: string }[] | undefined)?.filter((o) =>
      o.status ? activeStatuses.has(o.status) : false,
    ).length ?? 0;
  const pendingSug = (sugQ.data?.meta as { total?: number } | undefined)?.total ?? 0;

  const nextEv = nextEventQ.data?.event as { startsAt?: string | null } | null | undefined;
  let meetingsToday = 0;
  if (nextEv?.startsAt) {
    const s = new Date(nextEv.startsAt);
    if (sameLocalDay(s, new Date())) meetingsToday = 1;
  }

  const statusChips = (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200/95">
        {t('brief.chipFocusReady')}
      </span>
      {meetingsToday > 0 ? (
        <span className="inline-flex items-center rounded-full border border-white/10 bg-[#0F1624]/80 px-3 py-1 text-xs text-slate-300">
          {t('brief.meetingsToday', { count: meetingsToday })}
        </span>
      ) : null}
      <span className="inline-flex items-center rounded-full border border-white/10 bg-[#0F1624]/80 px-3 py-1 text-xs text-slate-300">
        {t('brief.followUpsOpen', { count: openObCount })}
      </span>
      {pendingSug > 0 ? (
        <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-950/25 px-3 py-1 text-xs text-amber-200/90">
          {t('brief.needConfirmation', { count: pendingSug })}
        </span>
      ) : null}
    </div>
  );

  const onboardingBanner = showOnboardingBanner ? (
    <div
      role="status"
      className={`mb-6 rounded-xl border border-cyan-500/30 bg-cyan-950/25 px-4 py-4 sm:px-5 ${los.textSecondary}`}
    >
      <p className="text-sm font-medium text-slate-100">{t('everyoneGate.homeOnboardingTitle')}</p>
      <p className="mt-2 text-sm leading-relaxed">{t('everyoneGate.homeOnboardingBody')}</p>
      <Link
        className={`mt-3 inline-flex text-sm font-medium ${los.accentLink}`}
        to="/welcome"
      >
        {t('everyoneGate.homeOnboardingCta')}
      </Link>
    </div>
  ) : null;

  if (!brief || !brief.items?.length) {
    return (
      <div className={los.page}>
        {apiErrorBanner}
        {onboardingBanner}
        <header className="mb-8 space-y-4">
          <p className={`text-sm font-medium ${los.accent}`}>{greeting()}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">
            {t('brief.title')}
          </h1>
          <p className={`max-w-xl text-[15px] leading-relaxed ${los.textSecondary}`}>
            {t('brief.attentionLine')}
          </p>
          {statusChips}
        </header>
        <EmptyState
          title={t('brief.noBriefTitle')}
          description={t('brief.emptyNoUrgentContinuity')}
        />
      </div>
    );
  }

  const grouped = groupByBucket(brief.items);
  const sections = [...grouped.keys()].sort((a, b) => bucketRank(a) - bucketRank(b));
  const firstDoNow = brief.items.find((i) => i.bucket === 'do_now');
  const dayLabel = formatBriefDay(brief.day, i18n.language);
  const modeBanner = q.data?.activeModeBanner as { mode: string; source: string } | undefined;

  return (
    <div className={los.page}>
      {apiErrorBanner}
      {onboardingBanner}
      <header className="mb-8 space-y-4">
        <p className={`text-sm font-medium ${los.accent}`}>{greeting()}</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">
              {t('brief.title')}
            </h1>
            <p className={`text-[15px] leading-relaxed ${los.textSecondary}`}>
              {t('brief.subtitleWithDate', { date: dayLabel })}
            </p>
            {statusChips}
          </div>
          <nav
            className="flex flex-wrap gap-3 text-sm"
            aria-label={lightHome ? t('brief.quickLinksCore') : t('brief.quickLinks')}
          >
            <Link className={los.accentLink} to="/suggestions">
              {t('nav.suggestions')}
            </Link>
            <Link className={los.accentLink} to="/capture">
              {t('nav.capture')}
            </Link>
            {!lightHome ? (
              <>
                <Link className={los.accentLink} to="/people">
                  {t('nav.people')}
                </Link>
                <Link className={los.accentLink} to="/events">
                  {t('nav.timeline')}
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      </header>

      {!lightHome && modeBanner ? (
        <div
          className={`mb-6 rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-sm ${los.textSecondary}`}
          role="status"
        >
          {modeBanner.source === 'manual' ? t('brief.modeBannerManual') : t('brief.modeBannerDefault')}{' '}
          <span className="font-medium text-cyan-200/95">{lifeModeLabel(t, modeBanner.mode)}</span>
          <Link className={`ms-2 text-xs ${los.accentLink}`} to="/profile/priority">
            {t('brief.modeBannerAdjust')}
          </Link>
        </div>
      ) : null}

      {firstDoNow ? (
        <section className="mb-10" aria-labelledby="brief-hero">
          <SectionHeader id="brief-hero" title={t('brief.nextUp')} subtitle={t('brief.nextUpSubtitle')} />
          <PriorityCard
            emphasis
            eyebrow={
              firstDoNow.reasonSummary || firstDoNow.oneLine ? t('brief.why') : undefined
            }
            title={firstDoNow.title}
            subtitle={itemSubtitle(firstDoNow)}
            footer={itemFooter(firstDoNow)}
          />
          {!lightHome && adaptationExplanation(firstDoNow.id) ? (
            <p
              className={`mt-3 border-s-2 border-cyan-500/35 ps-3 text-xs leading-relaxed ${los.textMuted}`}
            >
              {t('brief.prioritizedBecause')} {adaptationExplanation(firstDoNow.id)}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-10">
        {sections.map((bucket) => {
          const list = grouped.get(bucket) ?? [];
          if (!list.length) return null;
          const labelKey = BUCKET_LABEL[bucket] ?? null;
          const label = labelKey ? t(labelKey) : bucket.replace(/_/g, ' ');
          const isDoNow = bucket === 'do_now';
          const visibleList = list.filter((item) => !(isDoNow && firstDoNow?.id === item.id));
          const maxVisible = showAllByBucket[bucket] ? visibleList.length : 5;
          const hidden = Math.max(0, visibleList.length - maxVisible);
          return (
            <section key={bucket} aria-labelledby={`brief-${bucket}`}>
              <SectionHeader
                id={`brief-${bucket}`}
                title={label}
                subtitle={
                  bucket === 'needs_confirmation' ? t('brief.needsConfirmationHint') : undefined
                }
              />
              <ul className="space-y-4">
                {visibleList.slice(0, maxVisible).map((item) => {
                  return (
                    <li key={item.id}>
                      <PriorityCard
                        eyebrow={
                          item.reasonSummary || item.oneLine ? t('brief.why') : undefined
                        }
                        title={item.title}
                        subtitle={itemSubtitle(item)}
                        footer={itemFooter(item)}
                      />
                      {!lightHome && adaptationExplanation(item.id) ? (
                        <p
                          className={`mt-3 border-s-2 border-cyan-500/35 ps-3 text-xs leading-relaxed ${los.textMuted}`}
                        >
                          {t('brief.prioritizedBecause')} {adaptationExplanation(item.id)}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {hidden > 0 && !showAllByBucket[bucket] ? (
                <button
                  type="button"
                  className={`mt-3 text-sm ${los.accentLink}`}
                  onClick={() => setShowAllByBucket((s: Record<string, boolean>) => ({ ...s, [bucket]: true }))}
                >
                  {t('brief.showMore', { count: hidden })}
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
