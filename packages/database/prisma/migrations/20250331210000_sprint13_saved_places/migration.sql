-- Sprint 13 — Saved place catalog, aliases, optional link on PlaceEvent, location opt-in

CREATE TYPE "PlaceSensitivity" AS ENUM ('normal', 'home', 'work', 'private_sensitive');

CREATE TABLE "SavedPlace" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT,
  "sensitivity" "PlaceSensitivity" NOT NULL DEFAULT 'normal',
  "defaultMasked" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaceAlias" (
  "id" TEXT NOT NULL,
  "savedPlaceId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,

  CONSTRAINT "PlaceAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaceAlias_savedPlaceId_alias_key" ON "PlaceAlias"("savedPlaceId", "alias");
CREATE INDEX "PlaceAlias_alias_idx" ON "PlaceAlias"("alias");
CREATE INDEX "SavedPlace_userId_label_idx" ON "SavedPlace"("userId", "label");

ALTER TABLE "SavedPlace"
  ADD CONSTRAINT "SavedPlace_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaceAlias"
  ADD CONSTRAINT "PlaceAlias_savedPlaceId_fkey"
  FOREIGN KEY ("savedPlaceId") REFERENCES "SavedPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaceEvent" ADD COLUMN IF NOT EXISTS "savedPlaceId" TEXT;
CREATE INDEX IF NOT EXISTS "PlaceEvent_savedPlaceId_idx" ON "PlaceEvent"("savedPlaceId");

DO $fk_pe_sp$ BEGIN
  ALTER TABLE "PlaceEvent"
    ADD CONSTRAINT "PlaceEvent_savedPlaceId_fkey"
    FOREIGN KEY ("savedPlaceId") REFERENCES "SavedPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $fk_pe_sp$;

ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "locationIntelligenceOptIn" BOOLEAN NOT NULL DEFAULT false;
