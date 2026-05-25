-- ============================================================
-- MIGRATION: Additional guest request columns on stays table
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-guest-requests.sql --remote
-- Date: 2026-05-25
-- ============================================================
ALTER TABLE stays ADD COLUMN request_early_checkin  INTEGER DEFAULT 0;
ALTER TABLE stays ADD COLUMN request_late_checkout  INTEGER DEFAULT 0;
ALTER TABLE stays ADD COLUMN request_breakfast      INTEGER DEFAULT 0;
ALTER TABLE stays ADD COLUMN breakfast_choice       TEXT;
ALTER TABLE stays ADD COLUMN request_cab            INTEGER DEFAULT 0;
ALTER TABLE stays ADD COLUMN special_requests       TEXT;
