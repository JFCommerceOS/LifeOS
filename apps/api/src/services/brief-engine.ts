import { prisma, BriefBucket } from '@life-os/database';
import { startOfUtcDay } from '@life-os/shared';
import { partitionObligationsForBrief } from '../lib/brief-buckets.js';
import { ACTIVE_OBLIGATION_STATUSES, isActiveObligationStatus } from '../lib/obligation-active.js';
import { mediationDecisionToBriefBucket } from '../lib/mediation-brief-buckets.js';
import { mediateSuggestion } from './assistant-mediation-service.js';
import { persistUserStateSnapshot } from './user-state-service.js';
import { loadDismissalCountsBySuggestionId } from '../lib/suggestion-dismissal-count.js';
import { unsnoozeExpiredSuggestions } from '../lib/suggestion-lifecycle.js';
import type { AdminRecord } from '@prisma/client';
import { assembleEventContext } from './context-construction-service.js';
import { scoreEventPrepRelevance } from './prep-relevance-scoring.js';
import { briefBucketForAdminRecord } from './admin-mediation-service.js';
import {
  applyUprToBriefPriority,
  loadUprModifierContext,
  snapshotPriorityProfile,
} from './priority-adaptation-service.js';

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function startOfNextUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + 1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Sprint 02 — deterministic priority from due time, confidence, and obligation type. */
export function computeBriefPriority(
  ob: {
    dueAt: Date | null;
    confidence: number;
    obligationType: string | null;
  },
  now: Date,
): number {
  let s = 0;
  if (ob.dueAt) {
    if (ob.dueAt < now) s += 100;
    else if (sameUtcDay(ob.dueAt, now)) s += 85;
    else if (ob.dueAt < startOfNextUtcDay(now)) s += 70;
    else if (ob.dueAt.getTime() - now.getTime() < 48 * 3600000) s += 45;
  }
  s += (ob.confidence ?? 0.5) * 25;
  if (ob.obligationType === 'DEADLINE' || ob.obligationType === 'TASK_DEADLINE') s += 12;
  if (ob.obligationType === 'FOLLOW_UP' || ob.obligationType === 'EVENT_PREP') s += 8;
  return s;
}

/** Build or refresh today's daily brief from obligations + pending suggestions. */
export async function generateDailyBriefForUser(userId: string, day = new Date()): Promise<{ briefId: string }> {
  const dayKey = startOfUtcDay(day);
  await unsnoozeExpiredSuggestions(userId);
  await persistUserStateSnapshot(userId);

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);

  const [obligationsRaw, suggestions, nextEvent, dismissalCounts, adminBriefRows, uprCtx] = await Promise.all([
    prisma.obligation.findMany({
      where: { userId, status: 'open' },
      include: { _count: { select: { evidenceItems: true } } },
      take: 60,
    }),
    prisma.suggestion.findMany({
      where: { userId, state: 'pending' },
      orderBy: [{ rank: 'desc' }],
      take: 25,
      include: { _count: { select: { evidence: true } } },
    }),
    prisma.event.findFirst({
      where: { userId, startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
    }),
    loadDismissalCountsBySuggestionId(userId),
    prisma.adminRecord.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
      take: 25,
    }),
    loadUprModifierContext(userId),
  ]);

  void snapshotPriorityProfile(userId, uprCtx, 'daily_brief_regeneration').catch(() => undefined);

  const sugById = new Map(suggestions.map((s) => [s.id, s] as const));

  const brief = await prisma.dailyBrief.upsert({
    where: { userId_day: { userId, day: dayKey } },
    create: { userId, day: dayKey },
    update: {},
  });

  await prisma.dailyBriefItem.deleteMany({ where: { dailyBriefId: brief.id } });

  let sortOrder = 0;
  const items: {
    bucket: BriefBucket;
    title: string;
    oneLine?: string;
    refType?: string;
    refId?: string;
    reasonSummary?: string | null;
    evidenceCount?: number;
    priorityScore?: number;
    mediationReasonKey?: string | null;
    mediationToneKey?: string | null;
    /** Sprint 12 — Daily Brief badge (e.g. voice) */
    sourceKind?: string;
  }[] = [];

  type ObRow = (typeof obligationsRaw)[number];
  const obById = new Map(obligationsRaw.map((o) => [o.id, o]));
  const coveredObIds = new Set<string>();

  for (const s of suggestions) {
    const obId =
      s.linkedObligationId ??
      (s.linkedEntityType === 'Obligation' && s.linkedEntityId ? s.linkedEntityId : null);
    if (!obId) continue;
    const ob = obById.get(obId);
    if (!ob || !isActiveObligationStatus(ob.status)) continue;
    if (ob.suppressionUntil && ob.suppressionUntil > now) continue;

    const m = await mediateSuggestion(
      {
        userId,
        sourceEntityType: 'Suggestion',
        sourceEntityId: s.id,
        rank: s.rank,
        confidence: s.confidence,
        dismissCount: dismissalCounts.get(s.id) ?? 0,
        linkedObligationId: ob.id,
      },
      { persistLog: false },
    );

    const bucket = mediationDecisionToBriefBucket(m.mediationDecision, ob, now);
    if (!bucket) continue;

    const ec = s._count?.evidence ?? 0;
    coveredObIds.add(ob.id);

    const sugBase = typeof s.rank === 'number' && s.rank <= 1 ? s.rank * 100 : s.rank;
    const sugPri = applyUprToBriefPriority(Math.min(100, sugBase), ob, uprCtx).score;

    items.push({
      bucket,
      title: s.title,
      oneLine: m.reasonSummary ?? s.reason,
      refType: 'Suggestion',
      refId: s.id,
      reasonSummary: m.reasonSummary ?? s.reason,
      evidenceCount: ec,
      priorityScore: sugPri,
      mediationReasonKey: m.reasonKey,
      mediationToneKey: m.mediationToneKey ?? null,
    });
  }

  const uncovered = obligationsRaw.filter((o) => !coveredObIds.has(o.id));
  const ranked: ObRow[] = [...uncovered].sort((a, b) => {
    const bBase = computeBriefPriority(b, now);
    const aBase = computeBriefPriority(a, now);
    const bSc = applyUprToBriefPriority(bBase, b, uprCtx).score;
    const aSc = applyUprToBriefPriority(aBase, a, uprCtx).score;
    return bSc - aSc;
  });
  const forPartition = ranked.map((o) => ({ id: o.id, title: o.title, dueAt: o.dueAt }));
  const { doNow, doToday, watchWeek } = partitionObligationsForBrief(forPartition, now, in7);
  const byId = new Map(ranked.map((o) => [o.id, o]));

  for (const slice of doNow) {
    const ob = byId.get(slice.id);
    if (!ob) continue;
    const pri = applyUprToBriefPriority(computeBriefPriority(ob, now), ob, uprCtx).score;
    const ec = ob._count?.evidenceItems ?? 0;
    const oneLine =
      ob.reasonSummary?.trim() ||
      (ob.dueAt ? `Due ${ob.dueAt.toISOString()}` : ec ? `${ec} evidence link(s)` : undefined);
    items.push({
      bucket: 'do_now',
      title: ob.title,
      oneLine,
      refType: 'Obligation',
      refId: ob.id,
      reasonSummary: ob.reasonSummary,
      evidenceCount: ec,
      priorityScore: pri,
    });
  }

  if (nextEvent) {
    const evCtx = await assembleEventContext(userId, nextEvent.id);
    if (evCtx) {
      const conf = scoreEventPrepRelevance(evCtx);
      const names = evCtx.participants.map((p) => p.name).join(', ') || 'Add participants';
      const obC = evCtx.openObligations.length;
      const nd = evCtx.priorNotes.length + evCtx.relatedDocuments.length;
      const oneLine = `${names} · ${nextEvent.startsAt ? nextEvent.startsAt.toISOString() : 'Time TBD'} · ${obC} open follow-up(s) · ${nd} linked note(s)/doc(s)`;
      items.push({
        bucket: BriefBucket.before_meeting,
        title: `Before: ${nextEvent.title}`,
        oneLine,
        refType: 'Event',
        refId: nextEvent.id,
        reasonSummary:
          obC > 0
            ? 'Open obligations linked to this event or participants — review before you meet.'
            : nd > 0
              ? 'Linked notes or documents surfaced for this event.'
              : 'Next event on your calendar — link people or notes for richer prep.',
        evidenceCount: nd + obC,
        priorityScore: conf * 100,
      });
    } else {
      items.push({
        bucket: BriefBucket.before_meeting,
        title: `Before: ${nextEvent.title}`,
        oneLine: nextEvent.startsAt ? `Starts ${nextEvent.startsAt.toISOString()}` : 'Time TBD',
        refType: 'Event',
        refId: nextEvent.id,
      });
    }
  }

  for (const slice of doToday) {
    const ob = byId.get(slice.id);
    if (!ob) continue;
    const pri = applyUprToBriefPriority(computeBriefPriority(ob, now), ob, uprCtx).score;
    const ec = ob._count?.evidenceItems ?? 0;
    const oneLine =
      ob.reasonSummary?.trim() ||
      (ob.dueAt ? `Due ${ob.dueAt.toISOString()}` : ec ? `${ec} evidence link(s)` : undefined);
    items.push({
      bucket: BriefBucket.do_today,
      title: ob.title,
      oneLine,
      refType: 'Obligation',
      refId: ob.id,
      reasonSummary: ob.reasonSummary,
      evidenceCount: ec,
      priorityScore: pri,
    });
  }

  for (const slice of watchWeek) {
    const ob = byId.get(slice.id);
    if (!ob) continue;
    const pri = applyUprToBriefPriority(computeBriefPriority(ob, now), ob, uprCtx).score;
    const ec = ob._count?.evidenceItems ?? 0;
    const oneLine =
      ob.reasonSummary?.trim() ||
      (ob.dueAt ? `Due ${ob.dueAt.toISOString()}` : ec ? `${ec} evidence link(s)` : undefined);
    items.push({
      bucket: BriefBucket.watch_week,
      title: ob.title,
      oneLine,
      refType: 'Obligation',
      refId: ob.id,
      reasonSummary: ob.reasonSummary,
      evidenceCount: ec,
      priorityScore: pri,
    });
  }

  for (const ar of adminBriefRows) {
    const anchor = ar.dueAt ?? ar.renewsAt ?? ar.returnWindowEndsAt ?? ar.appointmentAt;
    if (!anchor && ar.adminType !== 'RECEIPT') continue;
    const bucket = briefBucketForAdminRecord(ar as AdminRecord, now);
    const oneLine = anchor
      ? `${ar.adminType.replace(/_/g, ' ')} · ${anchor.toISOString()}`
      : 'Review admin record';
    const adminBase = (ar.extractionConfidence ?? 0.55) * 100;
    const adminPri =
      adminBase * (uprCtx.domainWeights.admin ?? 1) * (uprCtx.effectiveMode === 'ADMIN' ? 1.15 : 1);
    items.push({
      bucket,
      title: `Admin: ${ar.title.slice(0, 100)}`,
      oneLine,
      refType: 'AdminRecord',
      refId: ar.id,
      reasonSummary: ar.reasonSummary || 'Admin Guard — evidence-backed reminder.',
      evidenceCount: ar.sourceDocumentId ? 1 : 0,
      priorityScore: adminPri,
    });
  }

  function obligationIdForBriefItem(it: (typeof items)[number]): string | null {
    if (it.refType === 'Obligation' && it.refId) return it.refId;
    if (it.refType === 'Suggestion' && it.refId) {
      const sug = sugById.get(it.refId);
      if (!sug) return null;
      return (
        sug.linkedObligationId ??
        (sug.linkedEntityType === 'Obligation' && sug.linkedEntityId ? sug.linkedEntityId : null) ??
        null
      );
    }
    return null;
  }

  const signalIdSet = new Set<string>();
  for (const it of items) {
    const oid = obligationIdForBriefItem(it);
    if (!oid) continue;
    const ob = obById.get(oid);
    if (ob?.sourceSignalId) signalIdSet.add(ob.sourceSignalId);
  }

  const voiceEnvelopes =
    signalIdSet.size === 0
      ? []
      : await prisma.signalEnvelope.findMany({
          where: { userId, id: { in: [...signalIdSet] } },
          select: { id: true, sourceType: true, signalType: true, rawPayloadJson: true },
        });

  const voiceExcerptBySignalId = new Map<string, string>();
  for (const env of voiceEnvelopes) {
    const isVoice =
      env.sourceType === 'voice' || env.signalType === 'VOICE_NOTE' || env.signalType === 'VOICE_CAPTURE';
    if (!isVoice) continue;
    try {
      const p = JSON.parse(env.rawPayloadJson) as { body?: string; transcript?: string };
      const t = (
        typeof p.body === 'string' ? p.body : typeof p.transcript === 'string' ? p.transcript : ''
      ).trim();
      if (t) voiceExcerptBySignalId.set(env.id, t.length > 90 ? `${t.slice(0, 89)}…` : t);
    } catch {
      /* ignore */
    }
  }

  for (const it of items) {
    const oid = obligationIdForBriefItem(it);
    if (!oid) continue;
    const ob = obById.get(oid);
    if (!ob?.sourceSignalId) continue;
    const env = voiceEnvelopes.find((e) => e.id === ob.sourceSignalId);
    if (!env) continue;
    const isVoice =
      env.sourceType === 'voice' || env.signalType === 'VOICE_NOTE' || env.signalType === 'VOICE_CAPTURE';
    if (!isVoice) continue;
    it.sourceKind = 'voice';
    const excerpt = voiceExcerptBySignalId.get(env.id);
    if (excerpt) {
      it.oneLine = it.oneLine ? `${excerpt} · ${it.oneLine}` : excerpt;
    }
  }

  const bucketOrder: Record<string, number> = {
    do_now: 0,
    before_meeting: 1,
    do_today: 2,
    watch_week: 3,
    needs_confirmation: 4,
  };
  items.sort((a, b) => (bucketOrder[a.bucket] ?? 99) - (bucketOrder[b.bucket] ?? 99));

  for (const it of items) {
    await prisma.dailyBriefItem.create({
      data: {
        userId,
        dailyBriefId: brief.id,
        bucket: it.bucket,
        sortOrder: sortOrder++,
        title: it.title,
        oneLine: it.oneLine,
        refType: it.refType,
        refId: it.refId,
        reasonSummary: it.reasonSummary ?? null,
        evidenceCount: it.evidenceCount ?? 0,
        priorityScore: it.priorityScore ?? null,
        mediationReasonKey: it.mediationReasonKey ?? null,
        mediationToneKey: it.mediationToneKey ?? null,
        ...(it.sourceKind ? { sourceKind: it.sourceKind } : {}),
      },
    });
  }

  for (const it of items) {
    if (it.refType === 'Obligation' && it.refId) {
      await prisma.obligation.update({
        where: { id: it.refId },
        data: { surfacedCount: { increment: 1 }, lastSurfacedAt: now },
      });
    }
    if (it.refType === 'Suggestion' && it.refId) {
      await prisma.suggestion.update({
        where: { id: it.refId },
        data: { lastShownAt: now },
      });
    }
  }

  return { briefId: brief.id };
}
