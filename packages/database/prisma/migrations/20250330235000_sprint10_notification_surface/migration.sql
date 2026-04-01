-- Sprint 10: notification surface + mobile runtime models

CREATE TYPE "NotificationSurfaceKind" AS ENUM (
  'DO_NOW',
  'DO_TODAY',
  'BEFORE_NEXT_EVENT',
  'ADMIN_DUE',
  'DOCUMENT_REVIEW',
  'MEMORY_CONFIRMATION',
  'CONTEXT_PREP',
  'DIGEST'
);

CREATE TYPE "NotificationUrgencyLevel" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

CREATE TYPE "NotificationPrivacyLevel" AS ENUM ('GENERIC', 'REDACTED', 'SENSITIVE');

CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('IN_APP', 'LOCAL_PUSH', 'PUSH');

CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'OPENED',
  'ACTED_ON',
  'SUPPRESSED',
  'FAILED'
);

CREATE TYPE "NotificationActionKind" AS ENUM (
  'OPEN',
  'CONFIRM',
  'DISMISS',
  'RESOLVE',
  'SNOOZE',
  'MUTE_CATEGORY',
  'OPEN_DETAIL',
  'OPEN_EVIDENCE'
);

CREATE TYPE "NotificationLockScreenMode" AS ENUM ('private_default', 'redacted_reason', 'full_detail');

CREATE TABLE "NotificationSurfaceEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "linkedEntityType" TEXT NOT NULL,
  "linkedEntityId" TEXT NOT NULL,
  "sourceSuggestionId" TEXT,
  "sourceMediationLogId" TEXT,
  "notificationType" "NotificationSurfaceKind" NOT NULL,
  "title" TEXT NOT NULL,
  "bodySummary" TEXT,
  "reasonSummary" TEXT,
  "urgencyLevel" "NotificationUrgencyLevel" NOT NULL DEFAULT 'NORMAL',
  "privacyLevel" "NotificationPrivacyLevel" NOT NULL DEFAULT 'REDACTED',
  "deliveryChannel" "NotificationDeliveryChannel" NOT NULL DEFAULT 'IN_APP',
  "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "actedAt" TIMESTAMP(3),
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationSurfaceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationUserPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lockScreenMode" "NotificationLockScreenMode" NOT NULL DEFAULT 'private_default',
  "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "criticalOverrideEnabled" BOOLEAN NOT NULL DEFAULT true,
  "doNowEnabled" BOOLEAN NOT NULL DEFAULT true,
  "doTodayEnabled" BOOLEAN NOT NULL DEFAULT true,
  "beforeNextEventEnabled" BOOLEAN NOT NULL DEFAULT true,
  "adminAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "documentAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "studyAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "healthAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
  "digestTime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationUserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDeviceRegistration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL,
  "appRuntimeType" TEXT NOT NULL,
  "pushTokenOrLocalDeviceKey" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationDeviceRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationActionLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notificationEventId" TEXT NOT NULL,
  "actionType" "NotificationActionKind" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationActionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationUserPreference_userId_key" ON "NotificationUserPreference"("userId");

CREATE INDEX "NotificationSurfaceEvent_userId_createdAt_idx"
  ON "NotificationSurfaceEvent"("userId", "createdAt");

CREATE INDEX "NotificationSurfaceEvent_userId_linkedEntityType_linkedEntityId_idx"
  ON "NotificationSurfaceEvent"("userId", "linkedEntityType", "linkedEntityId");

CREATE INDEX "NotificationSurfaceEvent_userId_deliveryStatus_idx"
  ON "NotificationSurfaceEvent"("userId", "deliveryStatus");

CREATE INDEX "NotificationSurfaceEvent_sourceMediationLogId_idx"
  ON "NotificationSurfaceEvent"("sourceMediationLogId");

CREATE INDEX "NotificationDeviceRegistration_userId_isActive_idx"
  ON "NotificationDeviceRegistration"("userId", "isActive");

CREATE INDEX "NotificationActionLog_userId_createdAt_idx" ON "NotificationActionLog"("userId", "createdAt");

CREATE INDEX "NotificationActionLog_notificationEventId_idx" ON "NotificationActionLog"("notificationEventId");

ALTER TABLE "NotificationSurfaceEvent"
  ADD CONSTRAINT "NotificationSurfaceEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationSurfaceEvent"
  ADD CONSTRAINT "NotificationSurfaceEvent_sourceSuggestionId_fkey"
  FOREIGN KEY ("sourceSuggestionId") REFERENCES "Suggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationSurfaceEvent"
  ADD CONSTRAINT "NotificationSurfaceEvent_sourceMediationLogId_fkey"
  FOREIGN KEY ("sourceMediationLogId") REFERENCES "AssistantMediationLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationUserPreference"
  ADD CONSTRAINT "NotificationUserPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDeviceRegistration"
  ADD CONSTRAINT "NotificationDeviceRegistration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationActionLog"
  ADD CONSTRAINT "NotificationActionLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationActionLog"
  ADD CONSTRAINT "NotificationActionLog_notificationEventId_fkey"
  FOREIGN KEY ("notificationEventId") REFERENCES "NotificationSurfaceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
