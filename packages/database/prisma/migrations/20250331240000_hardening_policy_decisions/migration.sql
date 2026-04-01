-- Hardening Phase A: PolicyDecision for notification_delivery surface

CREATE TYPE "PolicySurfaceKind" AS ENUM ('notification_delivery');
CREATE TYPE "PolicyOutcome" AS ENUM ('allow', 'deny');

CREATE TABLE "PolicyDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surface" "PolicySurfaceKind" NOT NULL,
    "outcome" "PolicyOutcome" NOT NULL,
    "reasonCodes" JSONB NOT NULL DEFAULT '[]',
    "context" JSONB,
    "refEntityType" TEXT,
    "refEntityId" TEXT,
    "notificationSurfaceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PolicyDecision_notificationSurfaceEventId_key" ON "PolicyDecision"("notificationSurfaceEventId");

CREATE INDEX "PolicyDecision_userId_surface_createdAt_idx" ON "PolicyDecision"("userId", "surface", "createdAt");

ALTER TABLE "PolicyDecision" ADD CONSTRAINT "PolicyDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PolicyDecision" ADD CONSTRAINT "PolicyDecision_notificationSurfaceEventId_fkey" FOREIGN KEY ("notificationSurfaceEventId") REFERENCES "NotificationSurfaceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
