import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import {
  deleteVoiceAudioFileIfLocal,
  finalizeVoiceCaptureToContinuity,
  persistVoiceAudioFile,
  runTranscriptionForCapture,
} from '../../services/voice-capture-commit-service.js';
import { normalizeTranscriptText } from '../../services/transcript-normalization-service.js';
import { weakTranscriptNeedsReview } from '../../services/voice-commit-guard.js';

const patchBody = z
  .object({
    transcript: z.string().optional(),
    title: z.string().optional(),
    retainedRawAudio: z.boolean().optional(),
    sourceDevice: z.string().nullable().optional(),
  })
  .strict();

const correctBody = z
  .object({
    transcript: z.string().min(1),
  })
  .strict();

export async function registerVoiceCaptureRoutes(app: FastifyInstance) {
  app.get('/voice-captures', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.voiceCapture.count({ where }),
      prisma.voiceCapture.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          transcriptSegments: { orderBy: { createdAt: 'asc' } },
          _count: { select: { audioEvidenceItems: true } },
        },
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.get('/voice-captures/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const capture = await prisma.voiceCapture.findFirst({
      where: { id, userId },
      include: {
        transcriptSegments: { orderBy: { createdAt: 'asc' } },
        audioEvidenceItems: { orderBy: { createdAt: 'desc' }, take: 40 },
      },
    });
    if (!capture) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    return reply.send({ capture });
  });

  app.post('/voice-captures', async (req, reply) => {
    const userId = await getUserId();
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (settings?.voiceCaptureEnabled === false) {
      return reply.status(403).send({ error: { code: 'VOICE_DISABLED', message: 'Voice capture is disabled in settings' } });
    }

    let audioBuffer: Buffer | null = null;
    let mimeType: string | undefined;
    let durationMs: number | undefined;
    let sourceDevice: string | undefined;

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'audio') {
        audioBuffer = await part.toBuffer();
        mimeType = part.mimetype;
      } else if (part.type === 'field') {
        if (part.fieldname === 'durationMs') {
          const n = Number(part.value);
          if (!Number.isNaN(n)) durationMs = n;
        }
        if (part.fieldname === 'sourceDevice' && typeof part.value === 'string') {
          sourceDevice = part.value;
        }
      }
    }

    if (!audioBuffer?.length) {
      return reply.status(400).send({ error: { code: 'NO_AUDIO', message: 'Multipart field `audio` is required' } });
    }

    const capture = await prisma.voiceCapture.create({
      data: {
        userId,
        transcript: '',
        transcriptOriginal: '',
        transcriptionStatus: 'pending',
        mimeType,
        durationMs,
        sourceDevice,
        retainedRawAudio: settings?.voiceRetainRawAudio ?? true,
      },
    });

    const { storageKey } = await persistVoiceAudioFile(userId, capture.id, audioBuffer, mimeType);
    await prisma.voiceCapture.update({
      where: { id: capture.id },
      data: { audioStorageKey: storageKey },
    });

    const transcribeResult = await runTranscriptionForCapture(userId, capture.id);
    const fresh = await prisma.voiceCapture.findFirstOrThrow({ where: { id: capture.id, userId } });

    await writeAudit(userId, 'voice_capture.create', {
      entityType: 'VoiceCapture',
      entityId: capture.id,
      meta: { transcriptionStatus: fresh.transcriptionStatus, needsReview: transcribeResult.needsReview },
    });

    return reply.status(201).send({ capture: fresh, transcribe: transcribeResult });
  });

  app.patch('/voice-captures/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.voiceCapture.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });

    const data: {
      retainedRawAudio?: boolean;
      sourceDevice?: string | null;
      transcript?: string;
      transcriptOriginal?: string;
      normalizedText?: string;
    } = {};
    if (body.data.retainedRawAudio !== undefined) data.retainedRawAudio = body.data.retainedRawAudio;
    if (body.data.sourceDevice !== undefined) data.sourceDevice = body.data.sourceDevice ?? null;
    if (body.data.transcript !== undefined) {
      data.transcript = body.data.transcript;
      data.transcriptOriginal = existing.transcriptOriginal || body.data.transcript;
      data.normalizedText = normalizeTranscriptText(body.data.transcript);
    }
    if (Object.keys(data).length === 0) {
      const capture = await prisma.voiceCapture.findFirstOrThrow({ where: { id, userId } });
      return reply.send({ capture });
    }

    const capture = await prisma.voiceCapture.update({
      where: { id },
      data,
    });
    await writeAudit(userId, 'voice_capture.patch', { entityType: 'VoiceCapture', entityId: id, meta: { keys: Object.keys(data) } });
    return reply.send({ capture });
  });

  app.delete('/voice-captures/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.voiceCapture.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });

    await deleteVoiceAudioFileIfLocal(existing.audioStorageKey);
    await prisma.audioEvidenceItem.deleteMany({ where: { voiceCaptureId: id } });
    await prisma.transcriptSegment.deleteMany({ where: { voiceCaptureId: id } });
    await prisma.voiceCapture.delete({ where: { id } });
    await writeAudit(userId, 'voice_capture.delete', { entityType: 'VoiceCapture', entityId: id });
    return reply.status(204).send();
  });

  app.post('/voice-captures/:id/transcribe', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.voiceCapture.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });

    const out = await runTranscriptionForCapture(userId, id);
    const capture = await prisma.voiceCapture.findFirstOrThrow({ where: { id, userId } });
    await writeAudit(userId, 'voice_capture.transcribe', { entityType: 'VoiceCapture', entityId: id, meta: out });
    return reply.send({ capture, transcribe: out });
  });

  app.post('/voice-captures/:id/confirm-transcript', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.voiceCapture.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });

    try {
      await finalizeVoiceCaptureToContinuity(userId, id, { userConfirmed: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'EMPTY_TRANSCRIPT') {
        return reply.status(400).send({ error: { code: 'EMPTY_TRANSCRIPT', message: 'Transcript is empty' } });
      }
      if (msg === 'VOICE_DISABLED') {
        return reply.status(403).send({ error: { code: 'VOICE_DISABLED', message: 'Voice capture is disabled' } });
      }
      throw e;
    }

    const capture = await prisma.voiceCapture.findFirstOrThrow({ where: { id, userId } });
    await writeAudit(userId, 'voice_capture.confirm', { entityType: 'VoiceCapture', entityId: id });
    return reply.send({
      capture,
      weak: weakTranscriptNeedsReview(capture.transcriptConfidence) && !capture.userCorrectedTranscript,
    });
  });

  app.post('/voice-captures/:id/correct-transcript', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = correctBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.voiceCapture.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });

    const normalized = normalizeTranscriptText(body.data.transcript);
    await prisma.transcriptSegment.deleteMany({ where: { voiceCaptureId: id } });
    await prisma.voiceCapture.update({
      where: { id },
      data: {
        transcript: normalized,
        normalizedText: normalized,
        userCorrectedTranscript: true,
        transcriptConfidence: Math.max(existing.transcriptConfidence, 0.78),
        transcriptionStatus: 'complete',
      },
    });

    await prisma.transcriptSegment.create({
      data: {
        voiceCaptureId: id,
        startMs: 0,
        endMs: 0,
        text: normalized,
        confidence: Math.max(existing.transcriptConfidence, 0.78),
      },
    });

    const capture = await prisma.voiceCapture.findFirstOrThrow({ where: { id, userId } });
    await writeAudit(userId, 'voice_capture.correct', { entityType: 'VoiceCapture', entityId: id });
    return reply.send({ capture });
  });
}
