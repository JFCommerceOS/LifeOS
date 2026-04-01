import type { AdminRecord, BriefBucket } from '@prisma/client';

/** Map admin record to Daily Brief bucket (deterministic). */
export function briefBucketForAdminRecord(r: AdminRecord, now: Date): BriefBucket {
  if (r.snoozedUntil && r.snoozedUntil > now) {
    return 'watch_week';
  }
  const due = r.dueAt ?? r.renewsAt ?? r.returnWindowEndsAt ?? r.appointmentAt;
  if (!due) {
    return 'needs_confirmation';
  }
  const t = due.getTime();
  const n = now.getTime();
  const day = 86400000;
  if (t >= n - day && t < n + day) {
    return 'do_now';
  }
  if (t < n + 3 * day) {
    return 'do_today';
  }
  if (t < n + 14 * day) {
    return 'watch_week';
  }
  return 'watch_week';
}
