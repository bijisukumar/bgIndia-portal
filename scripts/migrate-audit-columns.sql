-- ============================================================
-- Migration: Add audit columns to all existing D1 tables
-- ============================================================
-- Run this ONCE against the live database BEFORE running the
-- rollback-test-data.sql or any new inserts.
--
-- Usage:
--   wrangler d1 execute bgindia-db \
--     --file=scripts/migrate-audit-columns.sql --remote
--
-- Safe to re-run: SQLite ignores "ALTER TABLE ADD COLUMN" if
-- the column already exists (it errors, but we catch below).
-- If you see "duplicate column name" errors, that's fine —
-- it means the column is already there.
--
-- Allowed values for created_by / updated_by:
--   'owner'   Biji (owner PIN login)
--   'raman'   RamananKutty (manager PIN login)
--   'pradosh' Pradosh (estate_manager PIN login)
--   'auto'    Automated / AI process (Airbnb poller, triggers)
--   'system'  Internal system (seed scripts, migrations, Worker)
-- ============================================================

-- ── stays ──────────────────────────────────────────────────
ALTER TABLE stays ADD COLUMN created_by TEXT DEFAULT 'owner';
ALTER TABLE stays ADD COLUMN updated_by TEXT DEFAULT 'owner';
-- created_at and updated_at already exist in stays

-- ── guest_requests ─────────────────────────────────────────
ALTER TABLE guest_requests ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE guest_requests ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
-- created_at already exists

-- ── stay_cars ──────────────────────────────────────────────
ALTER TABLE stay_cars ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE stay_cars ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
-- captured_at already exists (renamed conceptually to created_at, kept as-is)
ALTER TABLE stay_cars ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE stay_cars ADD COLUMN created_at TEXT DEFAULT (datetime('now'));

-- ── inventory ──────────────────────────────────────────────
ALTER TABLE inventory ADD COLUMN created_by TEXT DEFAULT 'system';
ALTER TABLE inventory ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE inventory ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE inventory ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- ── stay_incidentals ───────────────────────────────────────
ALTER TABLE stay_incidentals ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE stay_incidentals ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
ALTER TABLE stay_incidentals ADD COLUMN created_by TEXT DEFAULT 'raman';
-- created_at already exists

-- ── rental_props ───────────────────────────────────────────
-- updated_at already added in previous migration
ALTER TABLE rental_props ADD COLUMN created_by TEXT DEFAULT 'owner';
ALTER TABLE rental_props ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE rental_props ADD COLUMN updated_by TEXT DEFAULT 'owner';
-- Columns added in previous session (may already exist — errors are safe to ignore):
ALTER TABLE rental_props ADD COLUMN deposit         REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN agreed_rent     REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN maintenance_fee REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN notes           TEXT;

-- ── rental_income ──────────────────────────────────────────
ALTER TABLE rental_income ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE rental_income ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
ALTER TABLE rental_income ADD COLUMN created_by TEXT DEFAULT 'owner';
-- created_at already exists

-- ── coconut_harvests ───────────────────────────────────────
ALTER TABLE coconut_harvests ADD COLUMN created_by TEXT DEFAULT 'pradosh';
ALTER TABLE coconut_harvests ADD COLUMN updated_by TEXT DEFAULT 'pradosh';
ALTER TABLE coconut_harvests ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
-- created_at already exists

-- ── rubber_harvests ────────────────────────────────────────
ALTER TABLE rubber_harvests ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE rubber_harvests ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE rubber_harvests ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
-- created_at already exists

-- ── raman_commissions ──────────────────────────────────────
ALTER TABLE raman_commissions ADD COLUMN created_by TEXT DEFAULT 'system';
ALTER TABLE raman_commissions ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE raman_commissions ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
-- created_at already exists

-- ── New audit indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stays_audit      ON stays(created_by, updated_by);
CREATE INDEX IF NOT EXISTS idx_incidentals_stay ON stay_incidentals(stay_id);

-- ── Backfill existing rows with sensible defaults ──────────
-- Seed data rows → 'system'. Everything else → 'owner' (safest assumption).
UPDATE inventory         SET created_by='system', updated_by='system' WHERE created_by IS NULL;
UPDATE stays             SET created_by='owner',  updated_by='owner'  WHERE created_by IS NULL;
UPDATE guest_requests    SET created_by='raman',  updated_by='raman'  WHERE created_by IS NULL;
UPDATE stay_cars         SET created_by='raman',  updated_by='raman'  WHERE created_by IS NULL;
UPDATE stay_incidentals  SET created_by='raman',  updated_by='raman'  WHERE created_by IS NULL;
UPDATE rental_props      SET created_by='owner',  updated_by='owner'  WHERE created_by IS NULL;
UPDATE rental_income     SET created_by='owner',  updated_by='owner'  WHERE created_by IS NULL;
UPDATE coconut_harvests  SET created_by='pradosh',updated_by='pradosh' WHERE created_by IS NULL;
UPDATE rubber_harvests   SET created_by='raman',  updated_by='raman'  WHERE created_by IS NULL;
UPDATE raman_commissions SET created_by='system', updated_by='owner'  WHERE created_by IS NULL;

-- ── Verification ───────────────────────────────────────────
SELECT 'AUDIT COLUMN VERIFICATION' AS info;
SELECT 'stays'            AS tbl, COUNT(*) AS rows, COUNT(created_by) AS has_created_by, COUNT(updated_by) AS has_updated_by FROM stays
UNION ALL
SELECT 'guest_requests',   COUNT(*), COUNT(created_by), COUNT(updated_by) FROM guest_requests
UNION ALL
SELECT 'stay_cars',        COUNT(*), COUNT(created_by), COUNT(updated_by) FROM stay_cars
UNION ALL
SELECT 'inventory',        COUNT(*), COUNT(created_by), COUNT(updated_by) FROM inventory
UNION ALL
SELECT 'stay_incidentals', COUNT(*), COUNT(created_by), COUNT(updated_by) FROM stay_incidentals
UNION ALL
SELECT 'rental_props',     COUNT(*), COUNT(created_by), COUNT(updated_by) FROM rental_props
UNION ALL
SELECT 'rental_income',    COUNT(*), COUNT(created_by), COUNT(updated_by) FROM rental_income
UNION ALL
SELECT 'coconut_harvests', COUNT(*), COUNT(created_by), COUNT(updated_by) FROM coconut_harvests
UNION ALL
SELECT 'rubber_harvests',  COUNT(*), COUNT(created_by), COUNT(updated_by) FROM rubber_harvests
UNION ALL
SELECT 'raman_commissions',COUNT(*), COUNT(created_by), COUNT(updated_by) FROM raman_commissions;
-- rows = has_created_by = has_updated_by for every table = migration complete.
