import '@fastify/multipart';
import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { asflcGuardCheck } from '../../lib/asflc-client.js';
import { createHttpError, isHttpError } from '../../lib/http-error.js';
import { buildCapturePipelinePayload } from '../../lib/ingest-response.js';
import { loadLlmConfig } from '../../lib/llm-config.js';
import { logLlmInvocation } from '../../lib/llm-audit.js';
import { parseMultipartUpload } from '../../lib/parse-multipart-upload.js';
import { getUserId } from '../../lib/user.js';
import {
  captureEventCreated,
  captureNoteCreated,
  captureTaskCreated,
} from '../../services/capture-pipeline.js';
import { ingestDocumentUpload } from '../../services/document-intake-pipeline.js';
import { ingestAdminRecordFromNote } from '../../services/admin-ingest-service.js';
import { persistLlmInvocation } from '../../services/llm-invocation-log-service.js';
import { runCtxAfterEventCreated } from '../../services/ctx-capture-hooks.js';
import { runCtxAfterNoteCreated } from '../../services/ctx-capture-hooks.js';

const noteBody = z.object({
  body: z.string().min(1),
  title: z.string().optional(),
});

const taskBody = z.object({
  title: z.string().min(1),
  done: z.boolean().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

const eventBody = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function registerMobileCaptureRoutes(app: FastifyInstance) {
  app.post('/mobile/capture/note', async (req, reply) => {
    const userId = await getUserId();
    const body = noteBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const cfgN = loadLlmConfig();
    if (cfgN.asflcEnabled) {
      try {
        const textForGuard = [body.data.title, body.data.body].filter(Boolean).join('\n');
        const guard = await asflcGuardCheck(textForGuard, { config: cfgN });
        if (guard) {
          const audit = { tier: 1 as const, route: 'POST /mobile/capture/note', latencyMs: 0, ok: guard.allowed };
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
        }
      } catch (e) {
        if (isHttpError(e)) throw e;
        const auditErr = { tier: 1 as const, route: 'POST /mobile/capture/note', latencyMs: 0, ok: false as const };
        logLlmInvocation(req.log, auditErr);
        await persistLlmInvocation(userId, auditErr);
      }
    }

    const note = await prisma.note.create({
      data: { userId, body: body.data.body, title: body.data.title },
    });
    const signal = await captureNoteCreated(userId, note);
    await runCtxAfterNoteCreated(userId, { id: note.id, title: note.title, body: note.body });
    await ingestAdminRecordFromNote({
      userId,
      noteId: note.id,
      title: note.title,
      body: note.body,
    }).catch(() => {});
    await writeAudit(userId, 'note.create.mobile', { entityType: 'Note', entityId: note.id });
    const pipeline = await buildCapturePipelinePayload({ note }, signal);
    return reply.status(201).send(pipeline);
  });

  app.post('/mobile/capture/task', async (req, reply) => {
    const userId = await getUserId();
    const body = taskBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const row = await prisma.task.create({
      data: {
        userId,
        title: body.data.title,
        done: body.data.done ?? false,
        dueAt:
          body.data.dueAt === undefined ? undefined : body.data.dueAt ? new Date(body.data.dueAt) : null,
      },
    });
    const signal = await captureTaskCreated(userId, row);
    await writeAudit(userId, 'task.create.mobile', { entityType: 'Task', entityId: row.id });
    const pipeline = await buildCapturePipelinePayload({ task: row }, signal);
    return reply.status(201).send(pipeline);
  });

  app.post('/mobile/capture/event', async (req, reply) => {
    const userId = await getUserId();
    const body = eventBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const event = await prisma.event.create({
      data: {
        userId,
        title: body.data.title,
        description: body.data.description ?? undefined,
        startsAt:
          body.data.startsAt === undefined ? undefined : body.data.startsAt ? new Date(body.data.startsAt) : null,
        endsAt: body.data.endsAt === undefined ? undefined : body.data.endsAt ? new Date(body.data.endsAt) : null,
      },
    });

    const signal = await captureEventCreated(userId, {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      description: event.description,
    });

    await writeAudit(userId, 'event.create.mobile', { entityType: 'Event', entityId: event.id });
    await runCtxAfterEventCreated(userId, { id: event.id, title: event.title });
    const pipeline = await buildCapturePipelinePayload({ event }, signal);
    return reply.status(201).send(pipeline);
  });

  app.post('/mobile/capture/document', async (req, reply) => {
    const userId = await getUserId();
    let parsed: Awaited<ReturnType<typeof parseMultipartUpload>>;
    try {
      parsed = await parseMultipartUpload(req);
    } catch (e) {
      if ((e as Error).message === 'NO_FILE') {
        return reply.status(400).send({ error: { message: 'No file in multipart body', code: 'NO_FILE' } });
      }
      throw e;
    }

    try {
      const result = await ingestDocumentUpload({
        userId,
        buffer: parsed.buffer,
        fileName: parsed.fileName,
        mimeType: parsed.mimeType,
        title: parsed.title,
        sourceKind: parsed.sourceKind === 'camera' ? 'camera' : 'upload',
      });
      await writeAudit(userId, 'document.capture_upload.mobile', {
        entityType: 'Document',
        entityId: result.documentId,
        meta: { mimeType: parsed.mimeType },
      });
      return reply.status(201).send(result);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'FILE_TOO_LARGE') {
        return reply.status(413).send({ error: { message: 'File too large', code: 'FILE_TOO_LARGE' } });
      }
      if (msg === 'UNSUPPORTED_TYPE') {
        return reply.status(415).send({ error: { message: 'Unsupported file type', code: 'UNSUPPORTED_TYPE' } });
      }
      throw e;
    }
  });
}
