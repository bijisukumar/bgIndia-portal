-- MIGRATION: Add updated_at to guest_documents
-- This column is written by markDocumentUploaded (SET folder_created=1, updated_at=?)
-- and read by getDocumentStatus. Its absence caused markDocumentUploaded to fail
-- silently, leaving folder_created=0 and causing the 10-min poller loop.
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-guest-documents-updated-at.sql --remote
ALTER TABLE guest_documents ADD COLUMN updated_at TEXT;
UPDATE guest_documents SET updated_at = created_at WHERE updated_at IS NULL;
