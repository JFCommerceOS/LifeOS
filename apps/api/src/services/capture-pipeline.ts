import type { Note, Task } from '@prisma/client';
import { intakeSignal } from './signal-intake-service.js';

/** MVP §12.1: every note create produces a signal envelope + full processing pipeline. */
export async function captureNoteCreated(userId: string, note: Pick<Note, 'id' | 'body' | 'title'>) {
  return intakeSignal({
    userId,
    signalType: 'NOTE_CAPTURE',
    sourceType: 'manual',
    rawPayloadJson: JSON.stringify({
      noteId: note.id,
      body: note.body,
      ...(note.title ? { title: note.title } : {}),
    }),
  });
}

/** MVP §12.1: task create → structured signal. */
export async function captureTaskCreated(userId: string, task: Pick<Task, 'id' | 'title' | 'dueAt'>) {
  return intakeSignal({
    userId,
    signalType: 'TASK_ITEM',
    sourceType: 'manual',
    rawPayloadJson: JSON.stringify({
      taskId: task.id,
      title: task.title,
      ...(task.dueAt ? { dueAt: task.dueAt.toISOString() } : {}),
    }),
  });
}

/** MVP §12.1: event create → calendar signal. */
export async function captureEventCreated(
  userId: string,
  event: { id: string; title: string; startsAt: Date | null; endsAt: Date | null; description: string | null },
) {
  return intakeSignal({
    userId,
    signalType: 'CALENDAR_EVENT',
    sourceType: 'manual',
    rawPayloadJson: JSON.stringify({
      eventId: event.id,
      title: event.title,
      ...(event.startsAt ? { startsAt: event.startsAt.toISOString() } : {}),
      ...(event.endsAt ? { endsAt: event.endsAt.toISOString() } : {}),
      ...(event.description ? { description: event.description } : {}),
    }),
  });
}

/** Sprint 12 — voice note committed after transcription / user confirmation (same pipeline as typed capture). */
export async function captureVoiceNoteCreated(
  userId: string,
  payload: {
    noteId: string;
    voiceCaptureId: string;
    title?: string | null;
    body: string;
    transcriptConfidence: number;
    voiceCommitConfirmed: boolean;
  },
) {
  return intakeSignal({
    userId,
    signalType: 'VOICE_NOTE',
    sourceType: 'voice',
    rawPayloadJson: JSON.stringify({
      noteId: payload.noteId,
      voiceCaptureId: payload.voiceCaptureId,
      ...(payload.title ? { title: payload.title } : {}),
      body: payload.body,
      transcript: payload.body,
      transcriptConfidence: payload.transcriptConfidence,
      voiceCommitConfirmed: payload.voiceCommitConfirmed,
    }),
    trustLevel: Math.round(Math.min(100, Math.max(10, payload.transcriptConfidence * 100))),
  });
}
