-- ============================================================
--  Fix: kitchen incidentals "Failed to save"
--
--  The stay_incidentals table is created with `CREATE TABLE IF NOT
--  EXISTS`, so when inv_item_id was added to schema.sql later, any
--  pre-existing prod table did NOT gain the column — every insert
--  that writes inv_item_id then fails.
--
--  Run against the STAYVIBE / villa D1 (bgindia-db):
--    npx wrangler d1 execute bgindia-db --file=scripts/migrate-stay-incidentals-invitem.sql --remote
--
--  If it errors with "duplicate column name: inv_item_id", the column
--  already exists — you're fine, the failure is something else (check
--  the exact toast now shown on save).
-- ============================================================

ALTER TABLE stay_incidentals ADD COLUMN inv_item_id TEXT;

-- Verify columns
PRAGMA table_info(stay_incidentals);
