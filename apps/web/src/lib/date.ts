/** Display dates with user/locale context — DB remains UTC; UI uses Intl. */
export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string,
): string {
  if (value == null || value === '') return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function formatBriefDay(value: string | Date | null | undefined, locale: string): string {
  if (value == null || value === '') return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      dateStyle: 'medium',
    }).format(d);
  } catch {
    return String(value).slice(0, 10);
  }
}
