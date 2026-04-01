-- Mediation i18n: stable keys for Daily Brief subtitle localization

ALTER TABLE "DailyBriefItem" ADD COLUMN IF NOT EXISTS "mediationReasonKey" TEXT;
ALTER TABLE "DailyBriefItem" ADD COLUMN IF NOT EXISTS "mediationToneKey" TEXT;
