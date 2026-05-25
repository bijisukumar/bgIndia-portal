-- MIGRATION: folder_created flag on stays + expiry on guest_documents
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-folder-flag.sql --remote
-- Date: 2026-05-25

-- Flag to track folder creation — can be reset to 0 to force reprocessing
ALTER TABLE stays ADD COLUMN folder_created INTEGER DEFAULT 0;

-- Add expiry timestamp to guest_documents — deleted after 24hrs once folder created
ALTER TABLE guest_documents ADD COLUMN expires_at TEXT;
ALTER TABLE guest_documents ADD COLUMN folder_created INTEGER DEFAULT 0;
