/** Sprint 11 — visible domain weights (starter pack §10). Keys are stable for API + UI. */

export const DEFAULT_DOMAIN_WEIGHTS: Record<string, number> = {
  work: 1,
  study: 1,
  admin: 1,
  personal: 1,
  health_tracking: 1,
};

export function parseDomainWeightsJson(raw: string | null | undefined): Record<string, number> {
  if (!raw?.trim()) return { ...DEFAULT_DOMAIN_WEIGHTS };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = { ...DEFAULT_DOMAIN_WEIGHTS };
    for (const k of Object.keys(DEFAULT_DOMAIN_WEIGHTS)) {
      const v = o[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0.25 && v <= 2) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_DOMAIN_WEIGHTS };
  }
}

/** Deterministic coarse domain from obligation text + type (no ML). */
export function classifyObligationDomain(args: {
  title: string;
  obligationType: string | null;
}): keyof typeof DEFAULT_DOMAIN_WEIGHTS {
  const t = `${args.title} ${args.obligationType ?? ''}`.toLowerCase();
  if (
    /\b(homework|assignment|exam|midterm|syllabus|lecture|course|class|study|university|school)\b/.test(t)
  ) {
    return 'study';
  }
  if (
    /\b(tax|invoice|bill|renew|dmv|passport|visa|receipt|deadline|admin)\b/.test(t) ||
    args.obligationType === 'TASK_DEADLINE'
  ) {
    return 'admin';
  }
  if (
    /\b(health|lab|prescription|appointment|doctor|clinic|track steps|fitness log)\b/.test(t)
  ) {
    return 'health_tracking';
  }
  if (
    /\b(meeting|client|deck|project|jira|slack|work|quarter)\b/.test(t) ||
    args.obligationType === 'EVENT_PREP'
  ) {
    return 'work';
  }
  return 'personal';
}

export function modeDomainAffinity(
  mode: string,
  domain: keyof typeof DEFAULT_DOMAIN_WEIGHTS,
): number {
  const m = mode as
    | 'WORK'
    | 'STUDY'
    | 'ADMIN'
    | 'PERSONAL'
    | 'MIXED'
    | 'TRAVEL'
    | 'HEALTH_RECORD_REVIEW';
  if (m === 'MIXED' || m === 'TRAVEL') return 1;
  if (m === 'WORK' && domain === 'work') return 1.2;
  if (m === 'STUDY' && domain === 'study') return 1.25;
  if (m === 'ADMIN' && domain === 'admin') return 1.2;
  if (m === 'PERSONAL' && domain === 'personal') return 1.15;
  if (m === 'HEALTH_RECORD_REVIEW' && domain === 'health_tracking') return 1.2;
  return 1;
}

export function mergeDeclaredAndInferredWeights(
  declared: Record<string, number>,
  inferredDelta: Record<string, number> | null,
): Record<string, number> {
  if (!inferredDelta) return declared;
  const out = { ...declared };
  for (const [k, d] of Object.entries(inferredDelta)) {
    if (!(k in out) || typeof d !== 'number' || !Number.isFinite(d)) continue;
    const next = Math.max(0.25, Math.min(2, (out[k] ?? 1) + d));
    out[k] = next;
  }
  return out;
}
