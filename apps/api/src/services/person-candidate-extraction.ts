/** Sprint 06 — lightweight person name candidates (no NLP dependency). */

const STOPWORDS = new Set([
  'The',
  'And',
  'For',
  'With',
  'From',
  'This',
  'That',
  'When',
  'Your',
  'Our',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]);

/**
 * Capitalized tokens that may be person names (English-centric heuristic).
 */
export function extractPersonCandidatesFromText(text: string, max = 10): string[] {
  const tokens = text.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * "Meeting with Sam", "Call with Dr. Smith", "Review with team lead" → first capture group trimmed.
 */
export function extractPrimaryNameFromEventTitle(title: string): string | null {
  const m = title.match(
    /\b(?:meeting|call|chat|sync|review|session|appointment)\s+with\s+([^,\n(]+?)(?:\s*[—\-–]\s*|\s*$)/i,
  );
  if (m) {
    const s = m[1].trim().replace(/\s+/g, ' ');
    if (s.length >= 2 && s.length < 120) return s;
  }
  return null;
}
