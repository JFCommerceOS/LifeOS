import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { scheduleCapturePipeline } from '../../lib/capture-scheduler.js';
import { captureVoiceNoteCreated } from '../../services/capture-pipeline.js';
import {
  getOrCreateUserLanguagePreference,
  getSupportedLanguageByTag,
  resolveInteractionFallback,
  routeStt,
  routeTts,
} from '../../services/language-stack.js';

const captureBody = z.object({
  transcript: z.string().min(1),
  title: z.string().optional(),
  audioStorageKey: z.string().optional(),
});

const testSttBody = z
  .object({
    languageTag: z.string().optional(),
    audioBase64: z.string().optional(),
  })
  .strict();

const testTtsBody = z
  .object({
    text: z.string().min(1).max(5000),
    languageTag: z.string().optional(),
  })
  .strict();

export async function registerVoiceRoutes(app: FastifyInstance) {
  app.get('/voice/captures', async (req, reply) => {
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
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/voice/capture', async (req, reply) => {
    const userId = await getUserId();
    const body = captureBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const title =
      body.data.title?.trim() ||
      body.data.transcript.split(/\n/)[0]!.slice(0, 80) ||
      'Voice capture';

    const { capture, note } = await prisma.$transaction(async (tx) => {
      const noteRow = await tx.note.create({
        data: {
          userId,
          body: body.data.transcript,
          title,
        },
      });
      const cap = await tx.voiceCapture.create({
        data: {
          userId,
          transcript: body.data.transcript,
          transcriptOriginal: body.data.transcript,
          normalizedText: body.data.transcript,
          transcriptionStatus: 'complete',
          transcriptConfidence: 0.9,
          audioStorageKey: body.data.audioStorageKey,
          noteId: noteRow.id,
        },
      });
      return { capture: cap, note: noteRow };
    });

    scheduleCapturePipeline(userId, 'voice', { entityType: 'Note', entityId: note.id }, () =>
      captureVoiceNoteCreated(userId, {
        noteId: note.id,
        voiceCaptureId: capture.id,
        title,
        body: note.body,
        transcriptConfidence: 0.9,
        voiceCommitConfirmed: true,
      }),
    );
    await writeAudit(userId, 'voice.capture', {
      entityType: 'VoiceCapture',
      entityId: capture.id,
      meta: { noteId: note.id },
    });

    return reply.status(201).send({ capture, note });
  });

  app.get('/voice/capabilities', async (_req, reply) => {
    const userId = await getUserId();
    const preference = await getOrCreateUserLanguagePreference(userId);
    const sttTag = preference.preferredSttLanguage ?? preference.primaryUiLanguage;
    const ttsTag = preference.preferredTtsLanguage ?? preference.primaryUiLanguage;
    const [sttRoute, ttsRoute, langStt, langTts] = await Promise.all([
      routeStt(sttTag),
      routeTts(ttsTag),
      getSupportedLanguageByTag(sttTag),
      getSupportedLanguageByTag(ttsTag),
    ]);
    return reply.send({
      preference,
      stt: sttRoute
        ? {
            ...sttRoute,
            fallback: resolveInteractionFallback(langStt, 'stt'),
          }
        : null,
      tts: ttsRoute
        ? {
            ...ttsRoute,
            fallback: resolveInteractionFallback(langTts, 'tts'),
          }
        : null,
      speechPipelineNote:
        'STT → assistant mediation → TTS. No opaque speech-to-speech; providers are selected from the language registry.',
    });
  });

  app.get('/voice/voices', async (_req, reply) => {
    const langs = await prisma.supportedLanguage.findMany({
      where: { ttsSupported: true },
      orderBy: { languageTag: 'asc' },
      include: { providerPolicies: true },
    });
    return reply.send({
      voices: langs.map((l) => ({
        languageTag: l.languageTag,
        displayName: l.displayName,
        provider: l.providerPolicies[0]?.ttsProvider ?? 'stub',
        sampleUrl: null as string | null,
      })),
    });
  });

  app.post('/voice/test-stt', async (req, reply) => {
    const userId = await getUserId();
    const body = testSttBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const preference = await getOrCreateUserLanguagePreference(userId);
    const languageTag = body.data.languageTag ?? preference.preferredSttLanguage ?? preference.primaryUiLanguage;
    const resolved = await routeStt(languageTag);
    if (!resolved) {
      return reply.status(400).send({
        error: { code: 'STT_UNAVAILABLE', message: 'STT not available for this language' },
      });
    }
    await writeAudit(userId, 'voice.test_stt', {
      meta: { languageTag, provider: resolved.provider, hasAudio: Boolean(body.data.audioBase64) },
    });
    return reply.send({
      ok: true,
      languageTag,
      provider: resolved.provider,
      transcript: '',
      note: 'Stub — no audio decoding in this build. Configure a real STT provider in LanguageProviderPolicy.',
    });
  });

  app.post('/voice/test-tts', async (req, reply) => {
    const userId = await getUserId();
    const body = testTtsBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const preference = await getOrCreateUserLanguagePreference(userId);
    const languageTag = body.data.languageTag ?? preference.preferredTtsLanguage ?? preference.primaryUiLanguage;
    const resolved = await routeTts(languageTag);
    if (!resolved) {
      return reply.status(400).send({
        error: { code: 'TTS_UNAVAILABLE', message: 'TTS not available for this language' },
      });
    }
    await writeAudit(userId, 'voice.test_tts', {
      meta: { languageTag, provider: resolved.provider, textLen: body.data.text.length },
    });
    return reply.send({
      ok: true,
      languageTag,
      provider: resolved.provider,
      audioBase64: null,
      durationMs: null,
      note: 'Stub — no audio synthesis in this build. Configure a real TTS provider in LanguageProviderPolicy.',
    });
  });
}
