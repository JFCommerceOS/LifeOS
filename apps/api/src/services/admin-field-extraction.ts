/** Sprint 07 — extract amounts, dates, return windows from free text (heuristics). */

export function extractMoneyFromText(text: string): number | null {
  const m = text.match(/\$\s*([\d,]+\.\d{2})|([\d,]+\.\d{2})\s*(?:USD|usd)?/);
  if (m) return parseFloat((m[1] ?? m[2]).replace(/,/g, ''));
  return null;
}

export function extractDateCandidates(text: string): Date[] {
  const out: Date[] = [];
  const re = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g;
  let m: RegExpExecArray | null;
  const s = text.slice(0, 20000);
  while ((m = re.exec(s)) !== null) {
    try {
      if (m[4]) {
        out.push(new Date(`${m[4]}-${m[5]}-${m[6]}T12:00:00Z`));
      } else {
        const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
        out.push(new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10), 12));
      }
    } catch {
      /* skip */
    }
  }
  return out.filter((d) => !Number.isNaN(d.getTime()));
}

function pickFutureOrNearest(dates: Date[]): Date | null {
  const now = Date.now();
  const future = dates.filter((d) => d.getTime() > now - 86400000);
  future.sort((a, b) => a.getTime() - b.getTime());
  return future[0] ?? dates[0] ?? null;
}

export function extractPrimaryDueDate(text: string): Date | null {
  const dates = extractDateCandidates(text);
  return pickFutureOrNearest(dates);
}

export function extractReturnByDate(text: string): Date | null {
  const m = text.match(/return\s+(?:by|before|until)\s+[^.\n]+/i);
  const slice = m ? `${m[0]}\n${text}` : text;
  const dates = extractDateCandidates(slice);
  return pickFutureOrNearest(dates);
}
