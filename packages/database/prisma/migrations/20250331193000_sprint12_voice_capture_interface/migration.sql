-- Sprint 12 — Voice capture, transcript segments, audio evidence, brief sourceKind, user settings, VOICE_NOTE signal

DO $voice_ts$ BEGIN
  CREATE TYPE "VoiceTranscriptionStatus" AS ENUM ('pending', 'transcribing', 'complete', 'failed', 'needs_review');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $voice_ts$;

ALTER TYPE "SignalType" ADD VALUE IF NOT EXISTS 'VOICE_NOTE';

ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "sourceDevice" TEXT;
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "transcriptionStatus" "VoiceTranscriptionStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "transcriptOriginal" TEXT NOT NULL DEFAULT '';
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "transcriptConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "normalizedText" TEXT;
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "languageCode" TEXT;
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "retainedRawAudio" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "userCorrectedTranscript" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VoiceCapture" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "VoiceCapture" SET "transcriptOriginal" = "transcript" WHERE ("transcriptOriginal" IS NULL OR "transcriptOriginal" = '') AND "transcript" IS NOT NULL;
UPDATE "VoiceCapture" SET "transcriptionStatus" = 'complete' WHERE "transcriptionStatus" = 'pending' AND COALESCE(TRIM("transcript"), '') <> '';

CREATE INDEX IF NOT EXISTS "VoiceCapture_userId_transcriptionStatus_idx" ON "VoiceCapture"("userId", "transcriptionStatus");

CREATE TABLE IF NOT EXISTS "TranscriptSegment" (
  "id" TEXT NOT NULL,
  "voiceCaptureId" TEXT NOT NULL,
  "startMs" INTEGER NOT NULL DEFAULT 0,
  "endMs" INTEGER NOT NULL DEFAULT 0,
  "text" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TranscriptSegment_voiceCaptureId_idx" ON "TranscriptSegment"("voiceCaptureId");

DO $fk_ts$ BEGIN
  ALTER TABLE "TranscriptSegment"
    ADD CONSTRAINT "TranscriptSegment_voiceCaptureId_fkey"
    FOREIGN KEY ("voiceCaptureId") REFERENCES "VoiceCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $fk_ts$;

CREATE TABLE IF NOT EXISTS "AudioEvidenceItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "linkedEntityType" TEXT NOT NULL,
  "linkedEntityId" TEXT NOT NULL,
  "voiceCaptureId" TEXT NOT NULL,
  "transcriptSegmentId" TEXT,
  "excerpt" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AudioEvidenceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AudioEvidenceItem_userId_createdAt_idx" ON "AudioEvidenceItem"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AudioEvidenceItem_voiceCaptureId_idx" ON "AudioEvidenceItem"("voiceCaptureId");

DO $fk_ae_user$ BEGIN
  ALTER TABLE "AudioEvidenceItem"
    ADD CONSTRAINT "AudioEvidenceItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $fk_ae_user$;

DO $fk_ae_vc$ BEGIN
  ALTER TABLE "AudioEvidenceItem"
    ADD CONSTRAINT "AudioEvidenceItem_voiceCaptureId_fkey"
    FOREIGN KEY ("voiceCaptureId") REFERENCES "VoiceCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $fk_ae_vc$;

DO $fk_ae_seg$ BEGIN
  ALTER TABLE "AudioEvidenceItem"
    ADD CONSTRAINT "AudioEvidenceItem_transcriptSegmentId_fkey"
    FOREIGN KEY ("transcriptSegmentId") REFERENCES "TranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $fk_ae_seg$;

ALTER TABLE "ExtractedFact" ADD COLUMN IF NOT EXISTS "transcriptSegmentId" TEXT;

CREATE INDEX IF NOT EXISTS "ExtractedFact_transcriptSegmentId_idx" ON "ExtractedFact"("transcriptSegmentId");

DO $fk_ef_seg$ BEGIN
  ALTER TABLE "ExtractedFact"
    ADD CONSTRAINT "ExtractedFact_transcriptSegmentId_fkey"
    FOREIGN KEY ("transcriptSegmentId") REFERENCES "TranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $fk_ef_seg$;

ALTER TABLE "DailyBriefItem" ADD COLUMN IF NOT EXISTS "sourceKind" TEXT;

ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "voiceCaptureEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "voiceRetainRawAudio" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "voiceTranscriptAutosave" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "spokenReadoutEnabled" BOOLEAN NOT NULL DEFAULT false;
