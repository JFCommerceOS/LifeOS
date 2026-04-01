-- Sprint 11 — User Profile & Priority adaptation (UPR)

CREATE TYPE "BriefDensityPreference" AS ENUM ('MINIMAL', 'BALANCED', 'DETAILED');

CREATE TYPE "UprReminderStyle" AS ENUM ('CALM', 'DIRECT', 'CHECKLIST', 'SUMMARY');

CREATE TYPE "MainLifeMode" AS ENUM (
  'WORK',
  'STUDY',
  'ADMIN',
  'PERSONAL',
  'MIXED',
  'TRAVEL',
  'HEALTH_RECORD_REVIEW'
);

CREATE TYPE "UprPrivacySensitivity" AS ENUM ('STANDARD', 'HIGH', 'STRICT');

CREATE TYPE "InferredPreferenceStatus" AS ENUM ('active', 'corrected', 'superseded');

CREATE TYPE "NotificationVerbosity" AS ENUM ('calm', 'direct');

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "preferredBriefDensity" "BriefDensityPreference" NOT NULL DEFAULT 'BALANCED';

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "uprReminderStyle" "UprReminderStyle" NOT NULL DEFAULT 'CALM';

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "preferredEscalationWindowHours" INTEGER;

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "workHoursWindowJson" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "quietHoursWindowJson" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "mainLifeModeDefault" "MainLifeMode" NOT NULL DEFAULT 'MIXED';

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "priorityDomainWeightsJson" TEXT NOT NULL DEFAULT '{"work":1,"study":1,"admin":1,"personal":1,"health_tracking":1}';

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "confidenceThresholdPreferencesJson" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "uprPrivacySensitivity" "UprPrivacySensitivity" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "NotificationUserPreference" ADD COLUMN IF NOT EXISTS "preferredReminderWindowStart" TEXT;

ALTER TABLE "NotificationUserPreference" ADD COLUMN IF NOT EXISTS "preferredReminderWindowEnd" TEXT;

ALTER TABLE "NotificationUserPreference" ADD COLUMN IF NOT EXISTS "notificationVerbosity" "NotificationVerbosity" NOT NULL DEFAULT 'calm';

CREATE TABLE "UserProfileMode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activeMode" "MainLifeMode" NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceEntityType" TEXT,
  "sourceEntityId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserProfileMode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreferenceInferenceSignal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "signalType" TEXT NOT NULL,
  "linkedEntityType" TEXT,
  "linkedEntityId" TEXT,
  "signalValueJson" TEXT NOT NULL DEFAULT '{}',
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PreferenceInferenceSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InferredPreferenceState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "preferenceKey" TEXT NOT NULL,
  "inferredValueJson" TEXT NOT NULL DEFAULT '{}',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "reasonSummary" TEXT,
  "status" "InferredPreferenceStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InferredPreferenceState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriorityProfileSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activeMode" "MainLifeMode" NOT NULL,
  "rankingWeightsJson" TEXT NOT NULL DEFAULT '{}',
  "triggerReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PriorityProfileSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptationDecisionLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetSurface" TEXT NOT NULL,
  "linkedEntityType" TEXT,
  "linkedEntityId" TEXT,
  "adaptationType" TEXT NOT NULL,
  "beforeValueJson" TEXT NOT NULL DEFAULT '{}',
  "afterValueJson" TEXT NOT NULL DEFAULT '{}',
  "reasonSummary" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdaptationDecisionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserProfileMode_userId_startsAt_idx" ON "UserProfileMode"("userId", "startsAt");

CREATE INDEX "UserProfileMode_userId_sourceType_idx" ON "UserProfileMode"("userId", "sourceType");

CREATE INDEX "PreferenceInferenceSignal_userId_signalType_observedAt_idx" ON "PreferenceInferenceSignal"("userId", "signalType", "observedAt");

CREATE INDEX "InferredPreferenceState_userId_preferenceKey_status_idx" ON "InferredPreferenceState"("userId", "preferenceKey", "status");

CREATE INDEX "PriorityProfileSnapshot_userId_createdAt_idx" ON "PriorityProfileSnapshot"("userId", "createdAt");

CREATE INDEX "AdaptationDecisionLog_userId_createdAt_idx" ON "AdaptationDecisionLog"("userId", "createdAt");

CREATE INDEX "AdaptationDecisionLog_userId_adaptationType_idx" ON "AdaptationDecisionLog"("userId", "adaptationType");

ALTER TABLE "UserProfileMode"
  ADD CONSTRAINT "UserProfileMode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreferenceInferenceSignal"
  ADD CONSTRAINT "PreferenceInferenceSignal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InferredPreferenceState"
  ADD CONSTRAINT "InferredPreferenceState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriorityProfileSnapshot"
  ADD CONSTRAINT "PriorityProfileSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdaptationDecisionLog"
  ADD CONSTRAINT "AdaptationDecisionLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
