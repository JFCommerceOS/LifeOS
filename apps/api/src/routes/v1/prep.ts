import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { getEventPrepPayload, recomputeEventPrep } from '../../services/event-prep-service.js';

export async function registerPrepRoutes(app: FastifyInstance) {
  app.get('/prep/events/:eventId', async (req, reply) => {
    const userId = await getUserId();
    const eventId = z.string().parse((req.params as { eventId: string }).eventId);
    const prep = await getEventPrepPayload(userId, eventId);
    if (!prep) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const { ctx, confidence, bundle } = prep;
    const top =
      ctx.openObligations[0]?.title ??
      ctx.priorNotes[0]?.title ??
      ctx.relatedDocuments[0]?.title ??
      ctx.prepSummary;

    return reply.send({
      prep: {
        prepSummary: ctx.prepSummary,
        confidence,
        whySurfaced:
          ctx.openObligations.length > 0
            ? 'Open follow-ups tied to this event or participants.'
            : ctx.priorNotes.length > 0 || ctx.relatedDocuments.length > 0
              ? 'Linked notes or documents for review.'
              : 'Next event on your calendar.',
        topPrepLine: top,
        linkedPersonNames: ctx.participants.map((p) => p.name),
        openObligationCount: ctx.openObligations.length,
        linkedNoteCount: ctx.priorNotes.length,
        linkedDocumentCount: ctx.relatedDocuments.length,
        bundleId: bundle?.id ?? null,
      },
      event: ctx.event,
      bundle,
    });
  });

  app.post('/prep/events/:eventId/recompute', async (req, reply) => {
    const userId = await getUserId();
    const eventId = z.string().parse((req.params as { eventId: string }).eventId);
    const out = await recomputeEventPrep(userId, eventId);
    if (!out) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    return reply.send(out);
  });
}
