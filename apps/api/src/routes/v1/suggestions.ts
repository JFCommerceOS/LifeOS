import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { unsnoozeExpiredSuggestions } from '../../lib/suggestion-lifecycle.js';
import { buildPaginatedMeta } from '@life-os/shared';
import {
  runSuggestionAction,
  runSuggestionResolveLinkedObligation,
  type SuggestionActionKind,
} from '../../services/suggestion-action-runner.js';
import { buildSuggestionAdaptationHints } from '../../services/adaptation-explanation-service.js';
import { loadUprModifierContext } from '../../services/priority-adaptation-service.js';
import { buildSuggestionReadout } from '../../services/speech-readout-service.js';

const actionBody = z.object({
  action: z.string().min(1),
  note: z.string().optional(),
  snoozeUntil: z.string().optional(),
  surface: z
    .enum(['DAILY_BRIEF', 'OBLIGATIONS', 'EVENT_DETAIL', 'MEMORY_INSPECTOR'])
    .optional(),
});

function normalizeSuggestionAction(raw: string): SuggestionActionKind | 'resolve' | 'open_detail' {
  const u = raw.trim().toUpperCase();
  if (u === 'CONFIRM' || u === 'ACCEPT') return 'accept';
  if (u === 'DISMISS') return 'dismiss';
  if (u === 'SNOOZE') return 'snooze';
  if (u === 'FALSE_POSITIVE' || u === 'FALSE POSITIVE') return 'false_positive';
  if (u === 'RESOLVE') return 'resolve';
  if (u === 'OPEN_DETAIL' || u === 'OPEN DETAIL') return 'open_detail';
  const lower = raw.trim().toLowerCase();
  if (lower === 'accept' || lower === 'dismiss' || lower === 'snooze' || lower === 'false_positive') {
    return lower as SuggestionActionKind;
  }
  throw new Error('UNKNOWN_ACTION');
}

export async function registerSuggestionRoutes(app: FastifyInstance) {
  app.post('/suggestions/:id/readout', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const payload = await buildSuggestionReadout(userId, id);
    await writeAudit(userId, 'suggestion.readout', { entityType: 'Suggestion', entityId: id, meta: { enabled: payload.enabled } });
    return reply.send(payload);
  });

  app.get('/suggestions', async (req, reply) => {
    const userId = await getUserId();
    await unsnoozeExpiredSuggestions(userId);
    const { page, pageSize, skip } = parsePagination(req);
    const inc = z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true')
      .safeParse((req.query as { includeAdaptation?: string }).includeAdaptation);
    const upr = inc.success && inc.data ? await loadUprModifierContext(userId) : null;
    const where = { userId, state: 'pending' as const };
    const [total, suggestions] = await Promise.all([
      prisma.suggestion.count({ where }),
      prisma.suggestion.findMany({
        where,
        orderBy: [{ rank: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          evidence: true,
          linkedObligation: {
            select: {
              id: true,
              title: true,
              status: true,
              dueAt: true,
              surfacedCount: true,
              lastSurfacedAt: true,
              suppressionUntil: true,
            },
          },
        },
      }),
    ]);
    const data =
      upr != null
        ? suggestions.map((s) => ({
            ...s,
            adaptation: buildSuggestionAdaptationHints(s.title, s.confidence, upr),
          }))
        : suggestions;
    return reply.send({
      data,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/suggestions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const suggestion = await prisma.suggestion.findFirst({
      where: { id, userId },
      include: {
        evidence: true,
        rankFactors: true,
        linkedObligation: true,
      },
    });
    if (!suggestion) return reply.status(404).send({ error: 'Not found' });

    const lastMediation =
      (suggestion.surfacedFromMediationLogId &&
        (await prisma.assistantMediationLog.findFirst({
          where: { id: suggestion.surfacedFromMediationLogId, userId },
        }))) ||
      (await prisma.assistantMediationLog.findFirst({
        where: { userId, sourceEntityType: 'Suggestion', sourceEntityId: suggestion.id },
        orderBy: { createdAt: 'desc' },
      }));

    const briefRefs = await prisma.dailyBriefItem.findMany({
      where: { userId, refType: 'Suggestion', refId: suggestion.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, dailyBriefId: true, bucket: true, createdAt: true },
    });

    return reply.send({
      suggestion,
      lastMediation,
      briefReferences: briefRefs,
      evidenceSummary: {
        count: suggestion.evidence.length,
        kinds: [...new Set(suggestion.evidence.map((e) => e.kind))],
      },
    });
  });

  app.post('/suggestions/:id/action', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = actionBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.suggestion.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    let normalized: ReturnType<typeof normalizeSuggestionAction>;
    try {
      normalized = normalizeSuggestionAction(body.data.action);
    } catch {
      return reply.status(400).send({ error: 'Invalid action' });
    }

    const trace = {
      surface: body.data.surface,
      feedbackType: body.data.action.trim().toUpperCase(),
    };

    if (normalized === 'open_detail') {
      await writeAudit(userId, 'suggestion.action', {
        entityType: 'Suggestion',
        entityId: id,
        meta: { action: 'open_detail', surface: body.data.surface },
      });
      return reply.send({ suggestion: existing, openDetail: true });
    }

    if (normalized === 'resolve') {
      try {
        const { suggestion, feedbackSignal } = await runSuggestionResolveLinkedObligation({
          userId,
          suggestionId: id,
          note: body.data.note,
          trace,
        });
        return reply.send({ suggestion, feedbackSignal });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'NO_LINKED_OBLIGATION') {
          return reply.status(400).send({
            error: { message: 'No linked obligation to resolve', code: 'NO_LINKED_OBLIGATION' },
          });
        }
        if (msg === 'RESOLVE_INVALID') {
          return reply.status(409).send({ error: { message: 'Cannot resolve obligation now', code: 'INVALID' } });
        }
        throw e;
      }
    }

    try {
      const { suggestion, feedbackSignal } = await runSuggestionAction({
        userId,
        suggestionId: id,
        action: normalized,
        note: body.data.note,
        snoozeUntilRaw: body.data.snoozeUntil,
        trace,
      });
      return reply.send({ suggestion, feedbackSignal });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'SNOOZE_NOT_ALLOWED' || msg === 'FALSE_POSITIVE_NOT_ALLOWED') {
        return reply.status(409).send({ error: { message: msg, code: 'CONFLICT' } });
      }
      if (msg === 'INVALID_SNOOZE' || msg === 'SNOOZE_PAST') {
        return reply.status(400).send({ error: { message: 'Invalid snoozeUntil', code: 'BAD_REQUEST' } });
      }
      if (msg === 'ACTION_NOT_ALLOWED') {
        return reply.status(409).send({ error: { message: 'Action not allowed for this state', code: 'CONFLICT' } });
      }
      throw e;
    }
  });
}
