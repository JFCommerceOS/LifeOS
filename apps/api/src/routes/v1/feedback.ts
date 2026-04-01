import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { applyStructuredFeedback, FeedbackApplyError } from '../../services/feedback-service.js';

const structuredSchema = z.object({
  linkedEntityType: z.enum(['SUGGESTION', 'OBLIGATION', 'MEMORY_NODE']),
  linkedEntityId: z.string().min(1),
  feedbackType: z.enum(['CONFIRM', 'DISMISS', 'RESOLVE', 'CORRECT', 'FALSE_POSITIVE']),
  note: z.string().optional(),
  surface: z.enum(['DAILY_BRIEF', 'OBLIGATIONS', 'EVENT_DETAIL', 'MEMORY_INSPECTOR']).optional(),
  correctionNote: z.string().optional(),
  correctedFields: z
    .object({
      summary: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const legacySchema = z.object({
  suggestionId: z.string().optional(),
  useful: z.boolean().optional(),
  note: z.string().optional(),
});

export async function registerFeedbackRoutes(app: FastifyInstance) {
  app.post('/feedback', async (req, reply) => {
    const userId = await getUserId();

    const structured = structuredSchema.safeParse(req.body);
    if (structured.success) {
      try {
        const result = await applyStructuredFeedback({
          userId,
          linkedEntityType: structured.data.linkedEntityType,
          linkedEntityId: structured.data.linkedEntityId,
          feedbackType: structured.data.feedbackType,
          note: structured.data.note,
          surface: structured.data.surface,
          correctionNote: structured.data.correctionNote,
          correctedFields: structured.data.correctedFields,
        });
        await writeAudit(userId, 'feedback.structured', {
          entityType: 'FeedbackSignal',
          entityId: result.signal.id,
          meta: { linkedEntityType: structured.data.linkedEntityType },
        });
        return reply.status(201).send({
          signal: result.signal,
          targetSummary: result.targetSummary,
          continuityEffect: result.continuityEffect,
        });
      } catch (e) {
        if (e instanceof FeedbackApplyError) {
          const status = e.code === 'NOT_FOUND' ? 404 : e.code === 'INVALID_TRANSITION' ? 409 : 400;
          return reply.status(status).send({ error: { message: e.message, code: e.code } });
        }
        throw e;
      }
    }

    const legacy = legacySchema.safeParse(req.body);
    if (!legacy.success) return reply.status(400).send({ error: legacy.error.flatten() });

    const signal = await prisma.feedbackSignal.create({
      data: {
        userId,
        suggestionId: legacy.data.suggestionId,
        useful: legacy.data.useful,
        note: legacy.data.note,
      },
    });
    await writeAudit(userId, 'feedback.create', { entityType: 'FeedbackSignal', entityId: signal.id });
    return reply.status(201).send({ signal });
  });
}
