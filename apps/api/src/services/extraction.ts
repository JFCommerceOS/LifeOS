/** Rule-based MVP extraction: follow-up, commitment, deadline, and review cues (pack §12.2). */
export function detectObligationsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];

  if (/\b(reply to|respond to|email|message|text|write to|call)\b/.test(lower)) {
    out.push('Reply or reach out');
  }
  if (/\b(follow up|follow-up|followup|checking in|check in)\b/.test(lower)) {
    out.push('Follow up on note');
  }
  if (/\b(need to|must|should|remember to|don't forget|have to|got to)\b/.test(lower)) {
    out.push('Action item from note');
  }
  if (/\b(review by|review before|deadline|due|eod|by friday|by monday|before friday|before monday)\b/.test(lower)) {
    out.push('Review deadline mentioned in note');
  }
  if (/\b(send|check|verify|confirm|schedule)\b/.test(lower)) {
    out.push('Follow through on note');
  }
  if (/\b(promise|committed|i will|we will|i'll|we'll)\b/.test(lower)) {
    out.push('Commitment to honor');
  }

  return [...new Set(out)];
}
