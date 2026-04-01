-- Hardening Sprint 02: mutation log, sync outbox, entity versions, conflicts, jobs, observability

-- CreateEnum
CREATE TYPE "SyncOutboxStatus" AS ENUM ('PENDING', 'LEASED', 'APPLIED', 'FAILED', 'BLOCKED_CONFLICT', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "syncOutboxPaused" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MutationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "actorType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "mutationType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "baseVersion" INTEGER NOT NULL DEFAULT 0,
    "newVersion" INTEGER NOT NULL DEFAULT 1,
    "causalGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOutbox" (
    "id" TEXT NOT NULL,
    "mutationId" TEXT NOT NULL,
    "targetScope" TEXT NOT NULL,
    "syncStatus" "SyncOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedByMutationId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "localMutationId" TEXT NOT NULL,
    "competingMutationId" TEXT NOT NULL,
    "resolutionType" TEXT NOT NULL,
    "resolutionSummary" TEXT NOT NULL,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "runStatus" "JobRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorSummary" TEXT,
    "outputSummary" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "traceType" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "sourceRef" TEXT,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplanationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surfacedEntityType" TEXT NOT NULL,
    "surfacedEntityId" TEXT NOT NULL,
    "reasonType" TEXT NOT NULL,
    "explanationJson" JSONB NOT NULL DEFAULT '{}',
    "evidenceRefsJson" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplanationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectionRefresh" (
    "id" TEXT NOT NULL,
    "projectionType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerRef" TEXT,
    "refreshStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectionRefresh_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MutationLog_userId_createdAt_idx" ON "MutationLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MutationLog_userId_entityType_entityId_idx" ON "MutationLog"("userId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOutbox_mutationId_key" ON "SyncOutbox"("mutationId");

-- CreateIndex
CREATE INDEX "SyncOutbox_syncStatus_nextRetryAt_idx" ON "SyncOutbox"("syncStatus", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntityVersion_userId_entityType_entityId_key" ON "EntityVersion"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "EntityVersion_userId_updatedAt_idx" ON "EntityVersion"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConflictEvent_userId_createdAt_idx" ON "ConflictEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ConflictEvent_userId_entityType_entityId_idx" ON "ConflictEvent"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ScheduledJob_userId_status_scheduledFor_idx" ON "ScheduledJob"("userId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledJob_userId_dedupeKey_idx" ON "ScheduledJob"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "JobRun_jobId_startedAt_idx" ON "JobRun"("jobId", "startedAt");

-- CreateIndex
CREATE INDEX "TraceEvent_userId_createdAt_idx" ON "TraceEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TraceEvent_userId_entityType_entityId_idx" ON "TraceEvent"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ExplanationEvent_userId_createdAt_idx" ON "ExplanationEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExplanationEvent_userId_surfacedEntityType_surfacedEntityId_idx" ON "ExplanationEvent"("userId", "surfacedEntityType", "surfacedEntityId");

-- CreateIndex
CREATE INDEX "ProjectionRefresh_userId_createdAt_idx" ON "ProjectionRefresh"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectionRefresh_userId_projectionType_idx" ON "ProjectionRefresh"("userId", "projectionType");

-- AddForeignKey
ALTER TABLE "MutationLog" ADD CONSTRAINT "MutationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutationLog" ADD CONSTRAINT "MutationLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "EdgeDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOutbox" ADD CONSTRAINT "SyncOutbox_mutationId_fkey" FOREIGN KEY ("mutationId") REFERENCES "MutationLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityVersion" ADD CONSTRAINT "EntityVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityVersion" ADD CONSTRAINT "EntityVersion_updatedByMutationId_fkey" FOREIGN KEY ("updatedByMutationId") REFERENCES "MutationLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictEvent" ADD CONSTRAINT "ConflictEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScheduledJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceEvent" ADD CONSTRAINT "TraceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplanationEvent" ADD CONSTRAINT "ExplanationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectionRefresh" ADD CONSTRAINT "ProjectionRefresh_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
