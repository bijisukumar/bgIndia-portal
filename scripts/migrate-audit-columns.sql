-- ============================================================
-- Migration: Add audit columns to all existing D1 tables
-- ============================================================
-- Run ONE TABLE AT A TIME if you hit errors.
-- "duplicate column name" errors are safe to ignore —
-- it means that column already exists. Move to the next block.
--
-- Wrangler D1 stops on first error in a file, so each table
-- is in its own clearly labelled block. If one block fails,
-- comment it out and re-run the file.
--
-- Usage:
--   wrangler d1 execute bgindia-db \
--     --file=scripts/migrate-audit-columns.sql --remote
-- ============================================================

ALTER TABLE stays ADD COLUMN created_by TEXT DEFAULT 'owner';
ALTER TABLE stays ADD COLUMN updated_by TEXT DEFAULT 'owner';

ALTER TABLE guest_requests ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE guest_requests ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE guest_requests ADD COLUMN updated_at TEXT;

ALTER TABLE stay_cars ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE stay_cars ADD COLUMN created_at TEXT;
ALTER TABLE stay_cars ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE stay_cars ADD COLUMN updated_at TEXT;

ALTER TABLE inventory ADD COLUMN created_by TEXT DEFAULT 'system';
ALTER TABLE inventory ADD COLUMN created_at TEXT;
ALTER TABLE inventory ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE inventory ADD COLUMN updated_at TEXT;

ALTER TABLE stay_incidentals ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE stay_incidentals ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE stay_incidentals ADD COLUMN updated_at TEXT;

ALTER TABLE rental_props ADD COLUMN deposit         REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN agreed_rent     REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN maintenance_fee REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN notes           TEXT;
ALTER TABLE rental_props ADD COLUMN created_by      TEXT DEFAULT 'owner';
ALTER TABLE rental_props ADD COLUMN created_at      TEXT;
ALTER TABLE rental_props ADD COLUMN updated_by      TEXT DEFAULT 'owner';
ALTER TABLE rental_props ADD COLUMN updated_at      TEXT;

ALTER TABLE rental_income ADD COLUMN created_by TEXT DEFAULT 'owner';
ALTER TABLE rental_income ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE rental_income ADD COLUMN updated_at TEXT;

ALTER TABLE coconut_harvests ADD COLUMN created_by TEXT DEFAULT 'pradosh';
ALTER TABLE coconut_harvests ADD COLUMN updated_by TEXT DEFAULT 'pradosh';
ALTER TABLE coconut_harvests ADD COLUMN updated_at TEXT;

ALTER TABLE rubber_harvests ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE rubber_harvests ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE rubber_harvests ADD COLUMN updated_at TEXT;

ALTER TABLE raman_commissions ADD COLUMN created_by TEXT DEFAULT 'system';
ALTER TABLE raman_commissions ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE raman_commissions ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_stays_audit      ON stays(created_by, updated_by);
CREATE INDEX IF NOT EXISTS idx_incidentals_stay ON stay_incidentals(stay_id);

UPDATE stays             SET updated_by='owner',   updated_at=updated_at  WHERE updated_by IS NULL;
UPDATE guest_requests    SET created_by='raman',   updated_by='raman',   updated_at=created_at  WHERE updated_by IS NULL;
UPDATE stay_cars         SET created_by='raman',   updated_by='raman',   created_at=captured_at, updated_at=captured_at WHERE updated_by IS NULL;
UPDATE inventory         SET created_by='system',  updated_by='system',  created_at=last_restocked, updated_at=last_restocked WHERE updated_by IS NULL;
UPDATE stay_incidentals  SET created_by='raman',   updated_by='raman',   updated_at=created_at  WHERE updated_by IS NULL;
UPDATE rental_props      SET created_by='owner',   updated_by='owner'    WHERE updated_by IS NULL;
UPDATE rental_income     SET created_by='owner',   updated_by='owner',   updated_at=created_at  WHERE updated_by IS NULL;
UPDATE coconut_harvests  SET created_by='pradosh', updated_by='pradosh', updated_at=created_at  WHERE updated_by IS NULL;
UPDATE rubber_harvests   SET created_by='raman',   updated_by='raman',   updated_at=created_at  WHERE updated_by IS NULL;
UPDATE raman_commissions SET created_by='system',  updated_by='owner',   updated_at=created_at  WHERE updated_by IS NULL;
