-- ============================================================
--  Fix: inventory table missing columns (schema drift)
--
--  Prod `inventory` was created before `preferred_stock` and
--  `active` were added to schema.sql. Because the table is created
--  with CREATE TABLE IF NOT EXISTS, re-running schema.sql never added
--  them. Any query referencing these columns throws "no such column",
--  which is what failed:
--    - kitchen incidentals save (SELECT ... preferred_stock after insert)
--    - low-stock alerts (WHERE preferred_stock > 0 ...)
--    - Preferred Stock / Restock saves
--    - inventory catalog soft-delete (WHERE active = 1)
--
--  Run against the STAYVIBE / villa D1 (bgindia-db):
--    npx wrangler d1 execute bgindia-db --file=scripts/migrate-inventory-add-columns.sql --remote
--
--  Defaults backfill every existing row: preferred_stock = 10, active = 1
--  (all current items stay visible; tune preferred levels in the
--  Preferred Stock tab afterwards). If either errors with
--  "duplicate column name", that column already exists — safe to ignore.
-- ============================================================

ALTER TABLE inventory ADD COLUMN preferred_stock INTEGER DEFAULT 10;
ALTER TABLE inventory ADD COLUMN active INTEGER DEFAULT 1;

-- Verify
PRAGMA table_info(inventory);
