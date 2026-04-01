import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@life-os/database';
import { scheduleCapturePipeline } from '../lib/capture-scheduler.js';
import { captureVoiceNoteCreated } from './capture-pipeline.js';
import { normalizeTranscriptText } from './transcript-normalization-service.js';
import { transcribeAudioBuffer } from './transcription-service.js';
import { weakTranscriptNeedsReview } from './voice-commit-guard.js';

export function extFromMime(mime: string | undefined): string {
  if (!mime) return 'bin';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

export function voiceStorageDir(userId: string): string {
  return path.join(process.cwd(), 'data', 'voice', userId);
}

/** Relative key under repo `data/` directory. */
export function voiceStorageKey(userId: string, captureId: string, ext: string): string {
  return `voice/${userId}/${captureId}.${ext}`.replace(/\\/g, '/');
}

export async function persistVoiceAudioFile(
  userId: string,
  captureId: string,
  buf: Buffer,
  mimeType: string | undefined,
): Promise<{ storageKey: string }> {
  const ext = extFromMime(mimeType);
  const dir = voiceStorageDir(userId);
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, `${captureId}.${ext}`);
  await writeFile(abs, buf);
  return { storageKey: voiceStorageKey(userId, captureId, ext) };
}

export async function deleteVoiceAudioFileIfLocal(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey || !storageKey.startsWith('voice/')) return;
  const abs = path.join(process.cwd(), 'data', ...storageKey.split('/'));
  try {
    await unlink(abs);
  } catch {
    /* ignore */
  }
}

export async function applyTranscriptionToCapture(
  userId: string,
  captureId: string,
  text: string,
  confidence: number,
  languageGuess: string | null,
): Promise<{ needsReview: boolean }> {
  const trimmed = text.trim();
  const original = trimmed;
  const normalized = normalizeTranscriptText(trimmed);
  const needsReview = !trimmed.length || weakTranscriptNeedsReview(confidence);

  await prisma.$transaction([
    prisma.transcriptSegment.deleteMany({ where: { voiceCaptureId: captureId } }),
    prisma.voiceCapture.update({
      where: { id: captureId, userId },
      data: {
        transcriptOriginal: original,
        transcript: needsReview ? original : normalized,
        normalizedText: normalized,
        transcriptConfidence: trimmed ? confidence : 0,
        languageCode: languageGuess ?? undefined,
        transcriptionStatus: !trimmed.length ? 'failed' : needsReview ? 'needs_review' : 'complete',
      },
    }),
  ]);

  if (trimmed.length) {
    await prisma.transcriptSegment.create({
      data: {
        voiceCaptureId: captureId,
        startMs: 0,
        endMs: 0,
        text: normalized,
        confidence,
      },
    });
  }

  return { needsReview: needsReview && Boolean(trimmed.length) };
}

export async function runTranscriptionForCapture(userId: string, captureId: string): Promise<{
  needsReview: boolean;
  transcriptionStatus: string;
}> {
  const capture = await prisma.voiceCapture.findFirst({ where: { id: captureId, userId } });
  if (!capture) throw new Error('CAPTURE_NOT_FOUND');

  if (!capture.audioStorageKey) {
    await prisma.voiceCapture.update({
      where: { id: captureId },
      data: { transcriptionStatus: 'failed' },
    });
    return { needsReview: false, transcriptionStatus: 'failed' };
  }

  const abs = path.join(process.cwd(), 'data', ...capture.audioStorageKey.split('/'));
  let buf: Buffer;
  try {
    const { readFile } = await import('node:fs/promises');
    buf = await readFile(abs);
  } catch {
    await prisma.voiceCapture.update({
      where: { id: captureId },
      data: { transcriptionStatus: 'failed' },
    });
    return { needsReview: false, transcriptionStatus: 'failed' };
  }

  await prisma.voiceCapture.update({
    where: { id: captureId },
    data: { transcriptionStatus: 'transcribing' },
  });

  const pref = await prisma.userLanguagePreference.findUnique({ where: { userId } });
  const lang = pref?.preferredSttLanguage ?? pref?.primaryUiLanguage ?? undefined;

  const { text, confidence, languageGuess } = await transcribeAudioBuffer(userId, buf, capture.mimeType ?? undefined, lang);
  const { needsReview } = await applyTranscriptionToCapture(userId, captureId, text, confidence, languageGuess);

  const updated = await prisma.voiceCapture.findFirstOrThrow({ where: { id: captureId, userId } });
  if (updated.transcriptionStatus === 'complete') {
    await maybeAutoCommitVoiceCapture(userId, captureId);
  }
  return { needsReview, transcriptionStatus: updated.transcriptionStatus };
}

export async function maybeAutoCommitVoiceCapture(userId: string, captureId: string): Promise<void> {
  const [capture, settings] = await Promise.all([
    prisma.voiceCapture.findFirst({ where: { id: captureId, userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);
  if (!capture || capture.transcriptionStatus !== 'complete') return;
  if (weakTranscriptNeedsReview(capture.transcriptConfidence)) return;
  const autosave = settings?.voiceTranscriptAutosave ?? true;
  if (!autosave) return;
  await finalizeVoiceCaptureToContinuity(userId, captureId, { userConfirmed: false });
}

export async function finalizeVoiceCaptureToContinuity(
  userId: string,
  captureId: string,
  opts: { userConfirmed: boolean },
): Promise<void> {
  const capture = await prisma.voiceCapture.findFirst({ where: { id: captureId, userId } });
  if (!capture) throw new Error('CAPTURE_NOT_FOUND');

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (settings && settings.voiceCaptureEnabled === false) throw new Error('VOICE_DISABLED');

  const text = normalizeTranscriptText(capture.transcript);
  if (!text.length) throw new Error('EMPTY_TRANSCRIPT');

  const weak = weakTranscriptNeedsReview(capture.transcriptConfidence) && !capture.userCorrectedTranscript;
  const voiceCommitConfirmed = opts.userConfirmed || !weak;

  const title = text.split(/\n/)[0]!.slice(0, 80) || 'Voice note';

  let noteId = capture.noteId;
  if (!noteId) {
    const note = await prisma.note.create({
      data: { userId, title, body: text },
    });
    noteId = note.id;
    await prisma.voiceCapture.update({
      where: { id: captureId },
      data: { noteId, transcript: text, normalizedText: text, transcriptionStatus: 'complete' },
    });
  } else {
    await prisma.note.updateMany({
      where: { id: noteId, userId },
      data: { title, body: text },
    });
    await prisma.voiceCapture.update({
      where: { id: captureId },
      data: { transcript: text, normalizedText: text, transcriptionStatus: 'complete' },
    });
  }

  const retain = settings?.voiceRetainRawAudio ?? true;
  if (!retain && capture.audioStorageKey) {
    await deleteVoiceAudioFileIfLocal(capture.audioStorageKey);
    await prisma.voiceCapture.update({
      where: { id: captureId },
      data: { audioStorageKey: null, retainedRawAudio: false },
    });
  }

  const conf = Math.min(0.95, Math.max(capture.transcriptConfidence, capture.userCorrectedTranscript ? 0.72 : 0));

  scheduleCapturePipeline(userId, 'voice', { entityType: 'VoiceCapture', entityId: captureId }, () =>
    captureVoiceNoteCreated(userId, {
      noteId,
      voiceCaptureId: captureId,
      title,
      body: text,
      transcriptConfidence: conf,
      voiceCommitConfirmed,
    }),
  );
}
