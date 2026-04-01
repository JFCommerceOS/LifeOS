import { prisma } from '@life-os/database';
import { writeAudit } from '../lib/audit.js';
import { parseDomainWeightsJson } from '../lib/upr-domain-weights.js';

export async function recordPreferenceInferenceSignal(args: {
  userId: string;
  signalType: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  signalValue?: Record<string, unknown>;
}): Promise<void> {
  const privacy = await prisma.userProfile.findUnique({
    where: { userId: args.userId },
    select: { uprPrivacySensitivity: true },
  });
  if (privacy?.uprPrivacySensitivity === 'STRICT') {
    const allowed = new Set(['brief_open', 'suggestion_dismiss', 'suggestion_resolve', 'obligation_resolve']);
    if (!allowed.has(args.signalType)) return;
  }

  await prisma.preferenceInferenceSignal.create({
    data: {
      userId: args.userId,
      signalType: args.signalType,
      linkedEntityType: args.linkedEntityType ?? undefined,
      linkedEntityId: args.linkedEntityId ?? undefined,
      signalValueJson: JSON.stringify(args.signalValue ?? {}),
    },
  });

  await maybeRollupWeakConfidenceDismiss(args.userId);
}

async function maybeRollupWeakConfidenceDismiss(userId: string): Promise<void> {
  const since = new Date(Date.now() - 30 * 86400000);
  const n = await prisma.preferenceInferenceSignal.count({
    where: { userId, signalType: 'dismiss_low_confidence_suggestion', observedAt: { gte: since } },
  });
  if (n < 3) return;

  const privacy = await prisma.userProfile.findUnique({
    where: { userId },
    select: { uprPrivacySensitivity: true },
  });
  const cap = privacy?.uprPrivacySensitivity === 'HIGH' ? 0.08 : 0.12;

  const existing = await prisma.inferredPreferenceState.findFirst({
    where: { userId, preferenceKey: 'low_confidence_surfacing', status: 'active' },
    orderBy: { updatedAt: 'desc' },
  });
  const value = { rankMultiplier: Math.max(0.85, 1 - cap) };
  const reason = 'Life OS noticed several dismissed low-confidence suggestions; surfacing similar items a bit less.';

  if (existing) {
    await prisma.inferredPreferenceState.update({
      where: { id: existing.id },
      data: {
        inferredValueJson: JSON.stringify(value),
        confidence: Math.min(0.85, 0.45 + n * 0.04),
        reasonSummary: reason,
      },
    });
  } else {
    await prisma.inferredPreferenceState.create({
      data: {
        userId,
        preferenceKey: 'low_confidence_surfacing',
        inferredValueJson: JSON.stringify(value),
        confidence: Math.min(0.85, 0.45 + n * 0.04),
        reasonSummary: reason,
        status: 'active',
      },
    });
  }
}

export async function resetPreferenceInference(userId: string): Promise<{ clearedSignals: number; clearedStates: number }> {
  const [sig, st] = await Promise.all([
    prisma.preferenceInferenceSignal.deleteMany({ where: { userId } }),
    prisma.inferredPreferenceState.deleteMany({ where: { userId } }),
  ]);
  await writeAudit(userId, 'profile.reset_inference', { meta: { signals: sig.count, states: st.count } });
  return { clearedSignals: sig.count, clearedStates: st.count };
}

export async function loadInferredWeightDeltas(userId: string): Promise<Record<string, number> | null> {
  const row = await prisma.inferredPreferenceState.findFirst({
    where: { userId, preferenceKey: 'domain_weight_delta', status: 'active' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!row) return null;
  try {
    return JSON.parse(row.inferredValueJson) as Record<string, number>;
  } catch {
    return null;
  }
}

/** User correction: set declared weights and supersede conflicting inference. */
export async function correctDeclaredDomainWeights(args: {
  userId: string;
  weights: Record<string, number>;
}): Promise<void> {
  const profile = await prisma.userProfile.findUnique({ where: { userId: args.userId } });
  const merged = JSON.stringify({
    ...parseDomainWeightsJson(profile?.priorityDomainWeightsJson ?? null),
    ...args.weights,
  });
  await prisma.userProfile.upsert({
    where: { userId: args.userId },
    create: { userId: args.userId, priorityDomainWeightsJson: merged },
    update: { priorityDomainWeightsJson: merged },
  });
  await prisma.inferredPreferenceState.updateMany({
    where: { userId: args.userId, preferenceKey: 'domain_weight_delta', status: 'active' },
    data: { status: 'superseded' },
  });
}
