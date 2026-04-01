-- Everyone Mode: beginner-first defaults + onboarding marker
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "everyoneModeEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
