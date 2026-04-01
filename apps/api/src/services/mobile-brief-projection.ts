import type { BriefBucket, DailyBriefItem } from '@prisma/client';

export type MobileBriefSection =
  | 'top_action'
  | 'do_now'
  | 'do_today'
  | 'before_next_event'
  | 'watch_list'
  | 'admin_due'
  | 'recent_documents';

export type MobileBriefCard = {
  id: string;
  bucket: BriefBucket;
  title: string;
  oneLine: string | null;
  reasonSummary: string | null;
  evidenceCount: number;
  priorityScore: number | null;
  refType: string | null;
  refId: string | null;
  deepLink: string;
};

function cardFromItem(item: DailyBriefItem): MobileBriefCard {
  const refType = item.refType ?? null;
  const refId = item.refId ?? null;
  const deepLink = buildMobileDeepLink(refType, refId, item.bucket);
  return {
    id: item.id,
    bucket: item.bucket,
    title: item.title,
    oneLine: item.oneLine ?? null,
    reasonSummary: item.reasonSummary ?? null,
    evidenceCount: item.evidenceCount,
    priorityScore: item.priorityScore ?? null,
    refType,
    refId,
    deepLink,
  };
}

export function buildMobileDeepLink(
  refType: string | null,
  refId: string | null,
  bucket: BriefBucket,
): string {
  if (refType && refId) {
    if (refType === 'Obligation') return `/m/obligations/${refId}`;
    if (refType === 'Suggestion') return `/suggestions`;
    if (refType === 'Event') return `/events/${refId}`;
    if (refType === 'Document') return `/documents/${refId}`;
    if (refType === 'AdminRecord' || refType === 'admin') return `/admin/${refId}`;
  }
  const q = new URLSearchParams({ bucket });
  return `/m?${q.toString()}`;
}

/** Map stored brief buckets to mobile sections (Sprint 10 §15). */
export function projectMobileBrief(items: DailyBriefItem[]): Record<MobileBriefSection, MobileBriefCard[]> {
  const byBucket = (b: BriefBucket) => items.filter((i) => i.bucket === b).map(cardFromItem);

  const doNow = byBucket('do_now');
  const doToday = byBucket('do_today');
  const before = byBucket('before_meeting');
  const watch = byBucket('watch_week');
  const confirm = byBucket('needs_confirmation');

  const topAction = doNow[0] ?? before[0] ?? doToday[0] ?? watch[0] ?? confirm[0] ?? null;

  const adminDue = items
    .filter(
      (i) =>
        i.refType === 'AdminRecord' ||
        (i.title.toLowerCase().includes('admin') && i.refType !== 'Obligation'),
    )
    .map(cardFromItem);

  const recentDocuments = items
    .filter((i) => i.refType === 'Document' || i.title.toLowerCase().includes('document'))
    .map(cardFromItem);

  return {
    top_action: topAction ? [topAction] : [],
    do_now: doNow,
    do_today: doToday,
    before_next_event: before,
    watch_list: watch,
    admin_due: adminDue,
    recent_documents: recentDocuments,
  };
}

export function projectMobileBriefSection(
  section: string,
  items: DailyBriefItem[],
): MobileBriefCard[] {
  const full = projectMobileBrief(items);
  if (section === 'top_action') return full.top_action;
  if (section === 'do_now') return full.do_now;
  if (section === 'do_today') return full.do_today;
  if (section === 'before_next_event') return full.before_next_event;
  if (section === 'watch_list') return full.watch_list;
  if (section === 'admin_due') return full.admin_due;
  if (section === 'recent_documents') return full.recent_documents;
  if (section === 'needs_confirmation')
    return items.filter((i) => i.bucket === 'needs_confirmation').map(cardFromItem);
  return [];
}
