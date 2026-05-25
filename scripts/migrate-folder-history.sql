-- MIGRATION: Add folder_created_at and processing_log to stays
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-folder-history.sql --remote
ALTER TABLE stays ADD COLUMN folder_created_at TEXT;
ALTER TABLE stays ADD COLUMN processing_log    TEXT;
