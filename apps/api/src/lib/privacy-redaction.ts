/** Ambient / semi-visible surfaces — generic copy when labels must stay private. */

export type RedactionContext = {
  /** When false, show truncated real titles (still no raw financial amounts on tile). */
  redactLabels: boolean;
  /** Strict privacy — stronger generic copy. */
  privacyStrict: boolean;
};

export function truncateLabel(text: string, max = 48): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function obligationHeadline(title: string | null | undefined, ctx: RedactionContext): string {
  if (!title?.trim()) return 'Open follow-up';
  if (ctx.redactLabels || ctx.privacyStrict) return 'Top follow-up';
  return truncateLabel(title);
}

export function obligationSubline(dueAt: Date | null | undefined, ctx: RedactionContext): string | undefined {
  if (!dueAt) return ctx.redactLabels ? 'When ready' : undefined;
  if (ctx.redactLabels || ctx.privacyStrict) return 'Due soon';
  return `Due ${dueAt.toISOString().slice(0, 16)}`;
}

export function eventHeadline(title: string | null | undefined, ctx: RedactionContext): string {
  if (!title?.trim()) return 'Next meeting';
  if (ctx.redactLabels || ctx.privacyStrict) return 'Next meeting';
  return truncateLabel(title);
}

export function eventSubline(startsAt: Date | null | undefined, ctx: RedactionContext): string | undefined {
  if (!startsAt) return undefined;
  if (ctx.redactLabels || ctx.privacyStrict) return 'Scheduled';
  return `Starts ${startsAt.toISOString().slice(0, 16)}`;
}

/** Never show currency amounts on ambient tile when redacting. */
export function adminRenewalHeadline(name: string | null | undefined, ctx: RedactionContext): string {
  if (ctx.redactLabels || ctx.privacyStrict) return 'Renewal coming up';
  return name?.trim() ? `Renewal: ${truncateLabel(name, 36)}` : 'Renewal coming up';
}

export function adminReturnHeadline(title: string | null | undefined, ctx: RedactionContext): string {
  if (ctx.redactLabels || ctx.privacyStrict) return 'Return window closing';
  return title?.trim() ? `Return: ${truncateLabel(title, 36)}` : 'Return window closing';
}
