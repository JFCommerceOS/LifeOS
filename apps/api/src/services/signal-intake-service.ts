import { createHash } from 'node:crypto';
import type { SignalSourceType, SignalType } from '@prisma/client';
import { prisma } from '@life-os/database';
import { asflcGuardCheck } from '../lib/asflc-client.js';
import { createHttpError, isHttpError } from '../lib/http-error.js';
import { loadLlmConfig } from '../lib/llm-config.js';
import { logLlmInvocation } from '../lib/llm-audit.js';
import { persistLlmInvocation } from './llm-invocation-log-service.js';
import { generateDailyBriefForUser } from './brief-engine.js';
import { recomputeSuggestionsForUser } from './suggestion-engine.js';
import { runSignalProcessingPipeline } from './signal-processing-orchestrator.js';

export type IntakeInput = {
  userId: string;
  signalType: SignalType;
  sourceType: SignalSourceType;
  rawPayloadJson: string;
  sourceConnectorId?: string | null;
  sourceRecordId?: string | null;
  occurredAt?: Date | null;
  languageCode?: string | null;
  privacyClass?: string | null;
  trustLevel?: number | null;
  /** When true (e.g. batch connector sync), skip suggestion recompute + daily brief regen per item. */
  skipContinuityEffects?: boolean;
};

export async function intakeSignal(input: IntakeInput) {
  if (input.sourceConnectorId) {
    const c = await prisma.sourceConnector.findFirst({
      where: { id: input.sourceConnectorId, userId: input.userId },
    });
    if (!c) throw new Error('Connector not found for user');
  }
  if (input.sourceRecordId) {
    const r = await prisma.sourceRecord.findFirst({
      where: { id: input.sourceRecordId, userId: input.userId },
    });
    if (!r) throw new Error('Source record not found for user');
  }

  const cfg = loadLlmConfig();
  if (cfg.asflcEnabled) {
    try {
      const guard = await asflcGuardCheck(input.rawPayloadJson, { config: cfg });
      if (guard) {
        logLlmInvocation(undefined, {
          tier: 1,
          route: 'intakeSignal.asflc_guard',
          latencyMs: 0,
          ok: guard.allowed,
        });
        if (!guard.allowed) {
          throw createHttpError(
            403,
            guard.block_reason === 'pii_plaintext'
              ? 'Signal blocked: possible sensitive data in payload'
              : 'Signal blocked by policy guard',
          );
        }
      } else {
        const auditSkip = {
          tier: 1 as const,
          route: 'intakeSignal.asflc_guard',
          latencyMs: 0,
          ok: false as const,
        };
        logLlmInvocation(undefined, auditSkip);
        await persistLlmInvocation(input.userId, auditSkip);
      }
    } catch (e) {
      if (isHttpError(e)) throw e;
      const auditErr = {
        tier: 1 as const,
        route: 'intakeSignal.asflc_guard',
        latencyMs: 0,
        ok: false as const,
      };
      logLlmInvocation(undefined, auditErr);
      await persistLlmInvocation(input.userId, auditErr);
    }
  }

  const contentHash = createHash('sha256').update(input.rawPayloadJson).digest('hex');

  const envelope = await prisma.signalEnvelope.create({
    data: {
      userId: input.userId,
      signalType: input.signalType,
      sourceType: input.sourceType,
      rawPayloadJson: input.rawPayloadJson,
      contentHash,
      occurredAt: input.occurredAt ?? undefined,
      languageCode: input.languageCode ?? 'en',
      privacyClass: input.privacyClass ?? 'medium',
      trustLevel: input.trustLevel ?? 50,
      sourceConnectorId: input.sourceConnectorId ?? undefined,
      sourceRecordId: input.sourceRecordId ?? undefined,
    },
  });

  await runSignalProcessingPipeline(envelope.id);

  const result = await prisma.signalEnvelope.findUniqueOrThrow({
    where: { id: envelope.id },
    include: {
      normalizedRecord: true,
      extractedFacts: { orderBy: { createdAt: 'asc' } },
      processingLogs: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!input.skipContinuityEffects) {
    await recomputeSuggestionsForUser(input.userId);
    await generateDailyBriefForUser(input.userId);
  }

  return result;
}
