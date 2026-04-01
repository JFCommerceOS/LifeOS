/**
 * Sprint 02 — transparent, test-covered deterministic parsing (no LLM).
 */

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type PersonCandidate = { label: string; pattern: string; confidence: number };
export type DeadlineCandidate = { token: string; kind: 'weekday' | 'relative' | 'iso' | 'phrase' };

/** Patterns: with Sam, reply to Alex, call John, … */
export function extractPersonCandidates(text: string): PersonCandidate[] {
  const out: PersonCandidate[] = [];
  const seen = new Set<string>();
  const patterns: { re: RegExp; pattern: string; group: number }[] = [
    { re: /\b(?:with|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, pattern: 'with_name', group: 1 },
    { re: /\b(?:reply|respond)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi, pattern: 'reply_to', group: 1 },
    { re: /\b(?:call|email|text|message|ask|send\s+to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, pattern: 'action_to', group: 1 },
    { re: /\bmeeting\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi, pattern: 'meeting_with', group: 1 },
  ];
  for (const { re, pattern, group } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const label = m[group]?.trim();
      if (!label || label.length < 2) continue;
      const key = `${pattern}:${label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label, pattern, confidence: 0.72 });
    }
  }
  return out.slice(0, 12);
}

export function extractDeadlineCandidates(text: string): DeadlineCandidate[] {
  const lower = text.toLowerCase();
  const out: DeadlineCandidate[] = [];
  const add = (token: string, kind: DeadlineCandidate['kind']) => {
    if (!out.some((o) => o.token === token)) out.push({ token, kind });
  };

  const rel = /\b(today|tonight|this evening)\b/.exec(lower);
  if (rel) add(rel[1], 'relative');
  if (/\btomorrow\b/.test(lower)) add('tomorrow', 'relative');
  if (/\bnext week\b/.test(lower)) add('next week', 'relative');
  if (/\bnext month\b/.test(lower)) add('next month', 'relative');

  for (const d of WEEKDAYS) {
    const re = new RegExp(`\\b(?:before|by|due|on)?\\s*(${d})\\b`, 'i');
    if (re.test(lower)) add(d, 'weekday');
  }

  const iso = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(text);
  if (iso) add(iso[1], 'iso');

  const dmy = /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2})\b/i.exec(text);
  if (dmy) add(dmy[1].trim(), 'phrase');

  return out.slice(0, 8);
}

/** Next occurrence of weekday name starting from ref (local). */
export function nextWeekdayFromName(name: string, ref: Date): Date | null {
  const idx = WEEKDAYS.indexOf(name.toLowerCase() as (typeof WEEKDAYS)[number]);
  if (idx < 0) return null;
  const d = new Date(ref);
  const day = d.getDay();
  let addDays = (idx - day + 7) % 7;
  if (addDays === 0) addDays = 7;
  d.setDate(d.getDate() + addDays);
  d.setHours(17, 0, 0, 0);
  return d;
}

export function inferDueDateFromCandidates(candidates: DeadlineCandidate[], ref: Date): Date | null {
  for (const c of candidates) {
    if (c.kind === 'weekday') {
      const dt = nextWeekdayFromName(c.token, ref);
      if (dt) return dt;
    }
    if (c.kind === 'relative') {
      const d = new Date(ref);
      if (c.token === 'tomorrow') {
        d.setDate(d.getDate() + 1);
        d.setHours(17, 0, 0, 0);
        return d;
      }
      if (c.token === 'today' || c.token === 'tonight' || c.token === 'this evening') {
        d.setHours(20, 0, 0, 0);
        return d;
      }
      if (c.token === 'next week') {
        d.setDate(d.getDate() + 7);
        d.setHours(17, 0, 0, 0);
        return d;
      }
    }
    if (c.kind === 'iso') {
      const t = Date.parse(`${c.token}T17:00:00`);
      if (!Number.isNaN(t)) return new Date(t);
    }
  }
  return null;
}

/** Short topic-ish phrase from first line or quoted segment. */
export function extractTopicHint(text: string): string | null {
  const line = text.split(/\n/)[0]?.trim() ?? '';
  if (line.length > 4 && line.length < 120) return line;
  return null;
}
