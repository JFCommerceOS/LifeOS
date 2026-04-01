import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { getEffectiveLifeMode, clearManualLifeModes, setManualLifeMode } from '../../services/life-mode-service.js';
import { loadUprModifierContext } from '../../services/priority-adaptation-service.js';
import {
  correctDeclaredDomainWeights,
  resetPreferenceInference,
} from '../../services/profile-inference-service.js';
import { parseDomainWeightsJson } from '../../lib/upr-domain-weights.js';

const modePost = z
  .object({
    activeMode: z.enum([
      'WORK',
      'STUDY',
      'ADMIN',
      'PERSONAL',
      'MIXED',
      'TRAVEL',
      'HEALTH_RECORD_REVIEW',
    ]),
    durationHours: z.number().min(1).max(168).optional(),
  })
  .strict();

const preferenceCorrect = z
  .object({
    preferenceKey: z.string().min(1).max(120),
    valueJson: z.record(z.string(), z.unknown()),
    note: z.string().max(2000).optional(),
  })
  .strict();

const domainWeightsCorrect = z
  .object({
    work: z.number().min(0.25).max(2).optional(),
    study: z.number().min(0.25).max(2).optional(),
    admin: z.number().min(0.25).max(2).optional(),
    personal: z.number().min(0.25).max(2).optional(),
    health_tracking: z.number().min(0.25).max(2).optional(),
  })
  .strict();

export async function registerProfileUprRoutes(app: FastifyInstance) {
  app.post('/profile/reset-inference', async (_req, reply) => {
    const userId = await getUserId();
    const result = await resetPreferenceInference(userId);
    return reply.send(result);
  });

  app.get('/profile/mode', async (_req, reply) => {
    const userId = await getUserId();
    const mode = await getEffectiveLifeMode(userId);
    return reply.send({ mode: mode.mode, source: mode.source, endsAt: mode.endsAt?.toISOString() ?? null });
  });

  app.post('/profile/mode', async (req, reply) => {
    const userId = await getUserId();
    const body = modePost.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const row = await setManualLifeMode({
      userId,
      activeMode: body.data.activeMode,
      durationHours: body.data.durationHours,
    });
    await writeAudit(userId, 'profile.mode.manual', { meta: body.data });
    return reply.status(201).send(row);
  });

  app.post('/profile/mode/clear', async (_req, reply) => {
    const userId = await getUserId();
    await clearManualLifeModes(userId);
    await writeAudit(userId, 'profile.mode.clear', {});
    return reply.send({ ok: true });
  });

  app.get('/profile/adaptation-state', async (_req, reply) => {
    const userId = await getUserId();
    const [profile, inferred, mode, modifiers] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.inferredPreferenceState.findMany({
        where: { userId, status: 'active' },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      }),
      getEffectiveLifeMode(userId),
      prisma.priorityProfileSnapshot.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const ctx = await loadUprModifierContext(userId);
    return reply.send({
      declared: profile
        ? {
            preferredBriefDensity: profile.preferredBriefDensity,
            uprReminderStyle: profile.uprReminderStyle,
            mainLifeModeDefault: profile.mainLifeModeDefault,
            priorityDomainWeights: parseDomainWeightsJson(profile.priorityDomainWeightsJson),
            uprPrivacySensitivity: profile.uprPrivacySensitivity,
            displayName: profile.displayName,
          }
        : null,
      inferred,
      activeMode: {
        mode: mode.mode,
        source: mode.source,
        endsAt: mode.endsAt?.toISOString() ?? null,
      },
      currentModifiers: {
        effectiveMode: ctx.effectiveMode,
        modeSource: ctx.modeSource,
        domainWeights: ctx.domainWeights,
        lowConfidenceRankMultiplier: ctx.lowConfidenceRankMultiplier,
        briefDensity: ctx.briefDensity,
        reminderStyle: ctx.reminderStyle,
      },
      latestSnapshot: modifiers,
    });
  });

  app.get('/profile/adaptation-logs', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.adaptationDecisionLog.count({ where }),
      prisma.adaptationDecisionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/profile/preference-correct', async (req, reply) => {
    const userId = await getUserId();
    const body = preferenceCorrect.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    await prisma.inferredPreferenceState.updateMany({
      where: { userId, preferenceKey: body.data.preferenceKey, status: 'active' },
      data: { status: 'superseded' },
    });

    const row = await prisma.inferredPreferenceState.create({
      data: {
        userId,
        preferenceKey: body.data.preferenceKey,
        inferredValueJson: JSON.stringify(body.data.valueJson),
        confidence: 1,
        reasonSummary: body.data.note ?? 'User-corrected preference.',
        status: 'corrected',
      },
    });

    if (body.data.preferenceKey === 'domain_weights') {
      const dw = domainWeightsCorrect.safeParse(body.data.valueJson);
      if (dw.success) await correctDeclaredDomainWeights({ userId, weights: dw.data });
    }

    await prisma.adaptationDecisionLog.create({
      data: {
        userId,
        targetSurface: 'profile',
        adaptationType: 'preference_correct',
        reasonSummary: body.data.note ?? `Corrected ${body.data.preferenceKey}`,
        beforeValueJson: '{}',
        afterValueJson: JSON.stringify(body.data.valueJson),
        confidence: 1,
      },
    });

    await writeAudit(userId, 'profile.preference_correct', { meta: body.data });
    return reply.status(201).send({ state: row });
  });
}
