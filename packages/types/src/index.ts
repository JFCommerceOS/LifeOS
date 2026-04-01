export * from './domain-enums.js';

/** Minimal DTOs for thin companion clients (watch / glance surfaces). */
export type BriefBucket =
  | 'do_now'
  | 'do_today'
  | 'before_meeting'
  | 'watch_week'
  | 'needs_confirmation';

export interface CompanionBriefItem {
  id: string;
  title: string;
  bucket: BriefBucket;
  oneLine?: string;
}

export interface CompanionBrief {
  date: string;
  items: CompanionBriefItem[];
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginatedMeta;
}

export * from './surfaces/tile.js';

/** Watch / tiny companion — no full archive (Phase 7). */
export interface WatchSurfacePayload {
  surface: 'watch';
  dueNow: { id: string; title: string; dueAt: string | null } | null;
  suggestion: { id: string; title: string; oneLine: string } | null;
  pendingSuggestions: number;
  briefLine: string;
}
