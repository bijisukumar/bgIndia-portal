-- MIGRATION: add extra beds columns to stays
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-extra-beds.sql --remote
ALTER TABLE stays ADD COLUMN request_extra_beds INTEGER DEFAULT 0;
ALTER TABLE stays ADD COLUMN extra_beds_count   INTEGER DEFAULT 0;
