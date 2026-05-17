-- ============================================================
-- Migration: Add audit columns to all existing D1 tables
-- ============================================================
-- SQLite restriction: ALTER TABLE ADD COLUMN only allows
-- constant defaults (NULL, 0, '', etc.) — NOT datetime('now').
-- So we add columns with NULL default, then backfill.
--
-- Usage:
--   wrangler d1 execute bgindia-db \
--     --file=scripts/migrate-audit-columns.sql --remote
--
-- Safe to re-run: duplicate column errors are harmless.
-- ============================================================

-- ── stays (created_at + updated_at already exist) ──────────
ALTER TABLE stays ADD COLUMN created_by TEXT DEFAULT 'owner';
ALTER TABLE stays ADD COLUMN updated_by TEXT DEFAULT 'owner';

-- ── guest_requests (created_at already exists) ─────────────
ALTER TABLE guest_requests ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE guest_requests ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE guest_requests ADD COLUMN updated_at TEXT;

-- ── stay_cars (captured_at already exists) ─────────────────
ALTER TABLE stay_cars ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE stay_cars ADD COLUMN created_at TEXT;
ALTER TABLE stay_cars ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE stay_cars ADD COLUMN updated_at TEXT;

-- ── inventory ──────────────────────────────────────────────
ALTER TABLE inventory ADD COLUMN created_by TEXT DEFAULT 'system';
ALTER TABLE inventory ADD COLUMN created_at TEXT;
ALTER TABLE inventory ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE inventory ADD COLUMN updated_at TEXT;

-- ── stay_incidentals (created_at already exists) ───────────
ALTER TABLE stay_incidentals ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE stay_incidentals ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE stay_incidentals ADD COLUMN updated_at TEXT;

-- ── rental_props ───────────────────────────────────────────
ALTER TABLE rental_props ADD COLUMN deposit         REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN agreed_rent     REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN maintenance_fee REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN notes           TEXT;
ALTER TABLE rental_props ADD COLUMN created_by TEXT DEFAULT 'owner';
ALTER TABLE rental_props ADD COLUMN created_at TEXT;
ALTER TABLE rental_props ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE rental_props ADD COLUMN updated_at TEXT;

-- ── rental_income (created_at already exists) ──────────────
ALTER TABLE rental_income ADD COLUMN created_by TEXT DEFAULT 'owner';
ALTER TABLE rental_income ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE rental_income ADD COLUMN updated_at TEXT;

-- ── coconut_harvests (created_at already exists) ───────────
ALTER TABLE coconut_harvests ADD COLUMN created_by TEXT DEFAULT 'pradosh';
ALTER TABLE coconut_harvests ADD COLUMN updated_by TEXT DEFAULT 'pradosh';
ALTER TABLE coconut_harvests ADD COLUMN updated_at TEXT;

-- ── rubber_harvests (created_at already exists) ────────────
ALTER TABLE rubber_harvests ADD COLUMN created_by TEXT DEFAULT 'raman';
ALTER TABLE rubber_harvests ADD COLUMN updated_by TEXT DEFAULT 'raman';
ALTER TABLE rubber_harvests ADD COLUMN updated_at TEXT;

-- ── raman_commissions (created_at already exists) ──────────
ALTER TABLE raman_commissions ADD COLUMN created_by TEXT DEFAULT 'system';
ALTER TABLE raman_commissions ADD COLUMN updated_by TEXT DEFAULT 'owner';
ALTER TABLE raman_commissions ADD COLUMN updated_at TEXT;

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stays_audit       ON stays(created_by, updated_by);
CREATE INDEX IF NOT EXISTS idx_incidentals_stay  ON stay_incidentals(stay_id);

-- ── Backfill timestamps and actors on existing rows ────────
UPDATE stays             SET created_by='owner',   updated_by='owner',   updated_at=updated_at   WHERE created_by IS NULL;
UPDATE guest_requests    SET created_by='raman',   updated_by='raman',   updated_at=created_at   WHERE created_by IS NULL;
UPDATE stay_cars         SET created_by='raman',   updated_by='raman',   created_at=captured_at, updated_at=captured_at WHERE created_by IS NULL;
UPDATE inventory         SET created_by='system',  updated_by='system',  created_at=datetime('now'), updated_at=datetime('now') WHERE created_by IS NULL;
UPDATE stay_incidentals  SET created_by='raman',   updated_by='raman',   updated_at=created_at   WHERE created_by IS NULL;
UPDATE rental_props      SET created_by='owner',   updated_by='owner',   created_at=datetime('now'), updated_at=datetime('now') WHERE created_by IS NULL;
UPDATE rental_income     SET created_by='owner',   updated_by='owner',   updated_at=created_at   WHERE created_by IS NULL;
UPDATE coconut_harvests  SET created_by='pradosh', updated_by='pradosh', updated_at=created_at   WHERE created_by IS NULL;
UPDATE rubber_harvests   SET created_by='raman',   updated_by='raman',   updated_at=created_at   WHERE created_by IS NULL;
UPDATE raman_commissions SET created_by='system',  updated_by='owner',   updated_at=created_at   WHERE created_by IS NULL;

-- ── Verification ───────────────────────────────────────────
SELECT 'VERIFICATION — rows should equal has_created_by and has_updated_by:' AS info;
SELECT 'stays'             AS tbl, COUNT(*) AS rows, COUNT(created_by) AS has_created_by, COUNT(updated_by) AS has_updated_by FROM stays
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
