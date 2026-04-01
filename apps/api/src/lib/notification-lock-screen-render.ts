import type { NotificationLockScreenMode, NotificationSurfaceKind } from '@prisma/client';

export type LockScreenPayload = {
  title: string;
  body: string | null;
};

const GENERIC_TITLE = 'Life OS';
const GENERIC_BODY = 'An important continuity item needs your attention.';

/** Sprint 10 §12 — lock-screen-safe copy; raw title/body never leak in private_default. */
export function renderNotificationForLockScreen(
  mode: NotificationLockScreenMode,
  args: {
    notificationType: NotificationSurfaceKind;
    rawTitle: string;
    rawBody: string | null;
    rawReason: string | null;
  },
): LockScreenPayload {
  const broad = broadReasonLine(args.notificationType, args.rawReason);

  if (mode === 'private_default') {
    return { title: GENERIC_TITLE, body: GENERIC_BODY };
  }

  if (mode === 'redacted_reason') {
    return { title: GENERIC_TITLE, body: broad };
  }

  // full_detail — still avoid obvious health/finance tokens in body-only; title can show truncated subject.
  const title = args.rawTitle.trim() ? truncate(args.rawTitle, 72) : GENERIC_TITLE;
  const body =
    redactSensitiveFragments(args.rawBody) ?? redactSensitiveFragments(args.rawReason) ?? broad;
  return { title, body: body ? truncate(body, 160) : GENERIC_BODY };
}

function broadReasonLine(type: NotificationSurfaceKind, reason: string | null): string {
  if (reason?.trim()) {
    const r = redactSensitiveFragments(reason);
    if (r) return truncate(r, 120);
  }
  switch (type) {
    case 'DO_NOW':
      return 'Something needs attention now.';
    case 'DO_TODAY':
      return 'You have continuity items for today.';
    case 'BEFORE_NEXT_EVENT':
      return 'Prep before your next event.';
    case 'ADMIN_DUE':
      return 'An admin item is due soon.';
    case 'DOCUMENT_REVIEW':
      return 'A document may need review.';
    case 'MEMORY_CONFIRMATION':
      return 'A memory item needs confirmation.';
    case 'CONTEXT_PREP':
      return 'Context prep suggestion.';
    case 'DIGEST':
    default:
      return 'Your Life OS digest is ready.';
  }
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const SENSITIVE_PATTERNS = [
  /\$\s*[\d,]+(\.\d{2})?/g,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b(ssn|social security)\b/i,
];

export function redactSensitiveFragments(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  let t = text.trim();
  for (const p of SENSITIVE_PATTERNS) t = t.replace(p, '—');
  return t;
}
