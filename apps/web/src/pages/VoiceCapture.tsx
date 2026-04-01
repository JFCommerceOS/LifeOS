import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { lifeOsApi } from '../lib/api';

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return '';
}

export default function VoiceCapture() {
  const qc = useQueryClient();
  const [transcript, setTranscript] = useState('');
  const [title, setTitle] = useState('');
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const stopTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const pasteCapture = useMutation({
    mutationFn: () =>
      lifeOsApi.postVoiceCapture({
        transcript: transcript.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
      }),
    onSuccess: () => {
      setTranscript('');
      setTitle('');
      void qc.invalidateQueries({ queryKey: ['notes'] });
      void qc.invalidateQueries({ queryKey: ['voice-captures'] });
    },
  });

  const uploadCapture = useMutation({
    mutationFn: async (blob: Blob) => {
      const form = new FormData();
      form.append('audio', blob, 'capture.webm');
      form.append('durationMs', String(Math.max(0, Date.now() - startedAtRef.current)));
      form.append('sourceDevice', typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'web');
      return lifeOsApi.postVoiceCaptureUpload(form);
    },
    onSuccess: (res) => {
      const cap = res.capture as { id?: string; transcriptionStatus?: string; transcript?: string; transcriptConfidence?: number };
      if (cap.id) setCaptureId(cap.id);
      if (typeof cap.transcript === 'string') setTranscript(cap.transcript);
      void qc.invalidateQueries({ queryKey: ['notes'] });
      void qc.invalidateQueries({ queryKey: ['voice-captures'] });
    },
  });

  const confirmCapture = useMutation({
    mutationFn: () => {
      if (!captureId) throw new Error('No capture');
      return lifeOsApi.confirmVoiceCaptureTranscript(captureId);
    },
    onSuccess: () => {
      setCaptureId(null);
      setTranscript('');
      void qc.invalidateQueries({ queryKey: ['notes'] });
      void qc.invalidateQueries({ queryKey: ['obligations'] });
      void qc.invalidateQueries({ queryKey: ['briefs'] });
    },
  });

  const correctCapture = useMutation({
    mutationFn: () => {
      if (!captureId) throw new Error('No capture');
      return lifeOsApi.correctVoiceCaptureTranscript(captureId, { transcript: transcript.trim() });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['voice-captures'] });
    },
  });

  const startRecording = async () => {
    setRecError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecError('Microphone not available in this browser.');
      return;
    }
    const mime = pickMimeType();
    if (!mime) {
      setRecError('Recording format not supported. Use paste-transcript below or Chrome / Edge.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(200);
      startedAtRef.current = Date.now();
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setRecording(true);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
    } catch {
      setRecError('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    stopTick();
    setRecording(false);
    if (!mr || mr.state === 'inactive') return;
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
      chunksRef.current = [];
      if (blob.size > 0) uploadCapture.mutate(blob);
    };
    mr.stop();
  };

  const weak =
    captureId != null &&
    uploadCapture.isSuccess &&
    (uploadCapture.data?.transcribe?.needsReview ||
      (uploadCapture.data?.capture as { transcriptionStatus?: string } | undefined)?.transcriptionStatus ===
        'needs_review');

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold">Voice capture</h1>
      <p className="text-sm text-zinc-500">
        Push-to-record (no always-on listening). Audio is uploaded, transcribed, then routed through the same
        continuity pipeline as typed notes. Weak transcripts stay in review until you confirm or edit.
      </p>

      <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={uploadCapture.isPending}
              className="rounded bg-cyan-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Record
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="rounded bg-rose-700 px-3 py-2 text-sm font-medium text-white"
            >
              Stop & upload
            </button>
          )}
          <span className="text-xs text-zinc-400 tabular-nums">{recording || seconds > 0 ? `${seconds}s` : ''}</span>
        </div>
        {recError ? <p className="text-sm text-amber-400">{recError}</p> : null}
        {uploadCapture.isPending ? <p className="text-sm text-zinc-400">Uploading & transcribing…</p> : null}
        {uploadCapture.isError ? (
          <p className="text-sm text-red-400">{(uploadCapture.error as Error).message}</p>
        ) : null}
        {weak ? (
          <p className="text-sm text-amber-400">
            Low-confidence transcription — edit the text if needed, then confirm to save into continuity.
          </p>
        ) : null}
      </div>

      {captureId ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!transcript.trim() || correctCapture.isPending}
            onClick={() => correctCapture.mutate()}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Save edited transcript
          </button>
          <button
            type="button"
            disabled={!transcript.trim() || confirmCapture.isPending}
            onClick={() => confirmCapture.mutate()}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirm & track
          </button>
        </div>
      ) : null}

      <label className="block">
        <span className="text-xs text-zinc-500">Transcript review</span>
        <textarea
          className="mt-1 w-full min-h-[140px] rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript appears after recording, or paste here for legacy save-as-note…"
        />
      </label>

      <div className="border-t border-zinc-800 pt-4 space-y-2">
        <p className="text-xs text-zinc-500">Legacy: save pasted transcript as note (high confidence path).</p>
        <label className="block">
          <span className="text-xs text-zinc-500">Optional title</span>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting follow-up"
          />
        </label>
        <button
          type="button"
          disabled={!transcript.trim() || pasteCapture.isPending}
          onClick={() => pasteCapture.mutate()}
          className="rounded bg-zinc-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save pasted transcript to note
        </button>
        {pasteCapture.isError ? (
          <p className="text-sm text-red-400">{(pasteCapture.error as Error).message}</p>
        ) : null}
        {pasteCapture.isSuccess ? (
          <p className="text-sm text-cyan-400">Saved — check Notes for the new entry.</p>
        ) : null}
      </div>

      {confirmCapture.isSuccess ? (
        <p className="text-sm text-cyan-400">Committed to continuity — brief and obligations may update shortly.</p>
      ) : null}
    </div>
  );
}
