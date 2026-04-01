/** Quiet hours using "HH:mm" strings in the user's IANA timezone (`UserSettings.timezone`). */

export function parseHm(hm: string | null | undefined): number | null {
  if (!hm?.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function minutesNowInTimeZone(now: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const min = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + min;
}

/**
 * Returns true when local "now" falls inside [start, end) if start < end,
 * or outside [end, start) when the window spans midnight.
 */
export function isInsideQuietHours(
  now: Date,
  timeZone: string,
  startHm: string | null | undefined,
  endHm: string | null | undefined,
): boolean {
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (start === null || end === null) return false;
  const cur = minutesNowInTimeZone(now, timeZone);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}
