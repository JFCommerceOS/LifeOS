import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { startOfUtcDay } from '@life-os/shared';
import { loadLlmConfig } from '../../lib/llm-config.js';
import { logLlmInvocation } from '../../lib/llm-audit.js';
import { ollamaChat } from '../../lib/llm-client.js';
import { persistLlmInvocation } from '../../services/llm-invocation-log-service.js';
import { getUserId } from '../../lib/user.js';
import { buildObligationBriefAdaptationPayload } from '../../services/adaptation-explanation-service.js';
import { loadUprModifierContext } from '../../services/priority-adaptation-service.js';
import { getEffectiveLifeMode } from '../../services/life-mode-service.js';
import { buildDailyBriefReadout } from '../../services/speech-readout-service.js';
import { writeAudit } from '../../lib/audit.js';

export async function registerBriefRoutes(app: FastifyInstance) {
  app.post('/briefs/today/readout', async (_req, reply) => {
    const userId = await getUserId();
    const payload = await buildDailyBriefReadout(userId);
    await writeAudit(userId, 'brief.readout', { meta: { enabled: payload.enabled, len: payload.text.length } });
    return reply.send(payload);
  });

  app.get('/briefs/today', async (req, reply) => {
    const userId = await getUserId();
    const explainQ = z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true')
      .safeParse((req.query as { explainAdaptation?: string }).explainAdaptation);
    const dayKey = startOfUtcDay(new Date());
    const brief = await prisma.dailyBrief.findFirst({
      where: { userId, day: dayKey },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!brief) {
      return reply.send({ brief: null, day: dayKey.toISOString() });
    }

    let adaptationExplanationByItemId: Record<string, ReturnType<typeof buildObligationBriefAdaptationPayload>> | undefined;
    let activeModeBanner: { mode: string; source: string } | undefined;

    if (explainQ.success && explainQ.data) {
      const ctx = await loadUprModifierContext(userId);
      adaptationExplanationByItemId = {};
      for (const i of brief.items) {
        if (i.refType === 'Obligation' && i.title) {
          adaptationExplanationByItemId[i.id] = buildObligationBriefAdaptationPayload(i.title, ctx);
        }
      }
    }

    const modeInfo = await getEffectiveLifeMode(userId);
    activeModeBanner = { mode: modeInfo.mode, source: modeInfo.source };

    return reply.send({
      brief,
      day: dayKey.toISOString(),
      activeModeBanner,
      adaptationExplanationByItemId,
      continuityHints: brief.items.map((i) => ({
        itemId: i.id,
        refType: i.refType,
        refId: i.refId,
        bucket: i.bucket,
        reasonSummary: i.reasonSummary,
        evidenceCount: i.evidenceCount,
        priorityScore: i.priorityScore,
      })),
    });
  });

  app.get('/briefs/daily/latest', async (req, reply) => {
    const userId = await getUserId();
    const companion = z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true')
      .safeParse((req.query as { companion?: string }).companion);

    const brief = await prisma.dailyBrief.findFirst({
      where: { userId },
      orderBy: { day: 'desc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!brief) {
      return reply.send({ brief: null, companion: companion.success && companion.data });
    }

    if (companion.success && companion.data) {
      return reply.send({
        brief: {
          id: brief.id,
          day: brief.day,
          items: brief.items.map((i) => ({
            id: i.id,
            title: i.title,
            bucket: i.bucket,
            oneLine: i.oneLine,
          })),
        },
      });
    }

    return reply.send({ brief });
  });

  /**
   * Tier 2 — optional local explanation via Ollama (`LLM_ENABLED=true`, `OLLAMA_BASE_URL`, `LLM_TIER2_MODEL`).
   * Does not write to the database; output is assistive only.
   */
  app.post('/briefs/items/:itemId/explain', async (req, reply) => {
    const userId = await getUserId();
    const { itemId } = req.params as { itemId: string };
    const item = await prisma.dailyBriefItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Brief item not found' } });
    }

    const cfg = loadLlmConfig();
    if (!cfg.llmEnabled) {
      return reply.send({
        enabled: false,
        explanation: null,
        message: 'LLM is disabled. Set LLM_ENABLED=true, run Ollama, and set LLM_TIER2_MODEL.',
      });
    }

    const system =
      'You are a calm assistant for a personal continuity app. Explain in 2–4 short sentences why this daily brief line matters, without guilt or pressure. Use plain language.';
    const userMsg = `Title: ${item.title}\nSummary: ${item.oneLine ?? '(none)'}\nBucket: ${item.bucket}\nReason: ${item.reasonSummary ?? '(none)'}`;

    const result = await ollamaChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      { config: cfg, maxTokens: 400 },
    );

    if (!result) {
      logLlmInvocation(req.log, {
        tier: 2,
        route: 'POST /briefs/items/:itemId/explain',
        latencyMs: 0,
        ok: false,
      });
      return reply.status(503).send({
        error: {
          code: 'LLM_UNAVAILABLE',
          message: 'Local model unavailable. Check Ollama is running and LLM_TIER2_MODEL exists.',
        },
      });
    }

    const auditOk = {
      tier: 2 as const,
      route: 'POST /briefs/items/:itemId/explain',
      model: result.model,
      latencyMs: result.latencyMs,
      promptHash: result.promptHash,
      ok: true as const,
      tokenCount: result.tokenCount,
    };
    logLlmInvocation(req.log, auditOk);
    await persistLlmInvocation(userId, auditOk);

    return reply.send({
      enabled: true,
      explanation: result.text,
      model: result.model,
      latencyMs: result.latencyMs,
      promptHash: result.promptHash,
      itemId: item.id,
    });
  });
}
