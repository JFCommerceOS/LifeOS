import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { asflcGuardCheck } from '../../lib/asflc-client.js';
import { createHttpError, isHttpError } from '../../lib/http-error.js';
import { loadLlmConfig } from '../../lib/llm-config.js';
import { logLlmInvocation } from '../../lib/llm-audit.js';
import { getUserId } from '../../lib/user.js';
import { persistLlmInvocation } from '../../services/llm-invocation-log-service.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { buildCapturePipelinePayload } from '../../lib/ingest-response.js';
import { captureNoteCreated } from '../../services/capture-pipeline.js';
import { runCtxAfterNoteCreated } from '../../services/ctx-capture-hooks.js';
import { ingestAdminRecordFromNote } from '../../services/admin-ingest-service.js';

const createBody = z.object({
  body: z.string().min(1),
  title: z.string().optional(),
});

export async function registerNoteRoutes(app: FastifyInstance) {
  app.get('/notes', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId, archivedAt: null };
    const [total, notes] = await Promise.all([
      prisma.note.count({ where }),
      prisma.note.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({
      data: notes,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.post('/notes', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const cfgN = loadLlmConfig();
    if (cfgN.asflcEnabled) {
      try {
        const textForGuard = [body.data.title, body.data.body].filter(Boolean).join('\n');
        const guard = await asflcGuardCheck(textForGuard, { config: cfgN });
        if (guard) {
          const audit = {
            tier: 1 as const,
            route: 'POST /notes.asflc_guard',
            latencyMs: 0,
            ok: guard.allowed,
          };
          logLlmInvocation(req.log, audit);
          await persistLlmInvocation(userId, audit);
          if (!guard.allowed) {
            throw createHttpError(
              403,
              guard.block_reason === 'pii_plaintext'
                ? 'Note blocked: possible sensitive data in text'
                : 'Note blocked by policy guard',
            );
          }
        } else {
          const auditSkip = {
            tier: 1 as const,
            route: 'POST /notes.asflc_guard',
            latencyMs: 0,
            ok: false as const,
          };
          logLlmInvocation(req.log, auditSkip);
          await persistLlmInvocation(userId, auditSkip);
        }
      } catch (e) {
        if (isHttpError(e)) throw e;
        const auditErr = {
          tier: 1 as const,
          route: 'POST /notes.asflc_guard',
          latencyMs: 0,
          ok: false as const,
        };
        logLlmInvocation(req.log, auditErr);
        await persistLlmInvocation(userId, auditErr);
      }
    }

    const note = await prisma.note.create({
      data: { userId, body: body.data.body, title: body.data.title },
    });
    const signal = await captureNoteCreated(userId, note);
    await runCtxAfterNoteCreated(userId, {
      id: note.id,
      title: note.title,
      body: note.body,
    });
    await ingestAdminRecordFromNote({
      userId,
      noteId: note.id,
      title: note.title,
      body: note.body,
    }).catch(() => {});
    await writeAudit(userId, 'note.create', { entityType: 'Note', entityId: note.id });
    const pipeline = await buildCapturePipelinePayload({ note }, signal);
    return reply.status(201).send(pipeline);
  });
}
