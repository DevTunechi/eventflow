-- Adds WhatsApp Business API fields to the
-- User (planner) model.
--
-- Run with:
--   npx prisma migrate dev --name add-whatsapp
--
-- OR apply manually if using migrate deploy:
--   psql $DATABASE_URL -f this_file.sql
-- ─────────────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "waAccessToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "waPhoneNumberId" TEXT,
  ADD COLUMN IF NOT EXISTS "waWabaId"        TEXT,
  ADD COLUMN IF NOT EXISTS "waDisplayName"   TEXT,
  ADD COLUMN IF NOT EXISTS "waPhoneNumber"   TEXT,
  ADD COLUMN IF NOT EXISTS "waBusinessName"  TEXT,
  ADD COLUMN IF NOT EXISTS "waConnectedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waMessagesSent"  INTEGER NOT NULL DEFAULT 0;
