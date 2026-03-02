-- ─────────────────────────────────────────────
-- prisma/migrations/20260302_remove_planner_wa_credentials/migration.sql
--
-- Removes per-planner WhatsApp Business credentials
-- from the User table. EventFlow now uses a single
-- platform-level WABA configured via environment
-- variables. These fields are no longer read or
-- written by any application code.
--
-- BEFORE RUNNING:
--   1. Deploy updated API routes (send, status)
--   2. Confirm no code still references wa* user fields
--   3. Back up production DB
--   4. Run: npx prisma migrate dev --name remove_planner_wa_credentials
-- ─────────────────────────────────────────────

ALTER TABLE "User" DROP COLUMN IF EXISTS "waAccessToken";
ALTER TABLE "User" DROP COLUMN IF EXISTS "waPhoneNumberId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "waWabaId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "waDisplayName";
ALTER TABLE "User" DROP COLUMN IF EXISTS "waPhoneNumber";
ALTER TABLE "User" DROP COLUMN IF EXISTS "waBusinessName";
ALTER TABLE "User" DROP COLUMN IF EXISTS "waConnectedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "waMessagesSent";
