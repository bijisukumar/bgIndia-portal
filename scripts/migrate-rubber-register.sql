-- ============================================================================
-- OBSOLETE — superseded by scripts/migrate-rubber-estates-tables-fix.sql
-- ============================================================================
-- Discovered 2026-07-09: the base rubber_production/manager_settlements
-- tables never existed in the ESTATES DB at all (only stale, 0-row copies in
-- bgindia-db) — this script's ALTER TABLE assumed they did, and its own
-- --file= command below has a typo'd DB name that doesn't exist
-- (bgindia-estates-db; the real one is bgindiadb-estates). Do not run this —
-- migrate-rubber-estates-tables-fix.sql already created both tables with
-- these columns included. Kept for history only.
-- ============================================================================
-- RUBBER PRODUCTION REGISTER COLUMNS (paper-register parity) — run ONCE
-- ============================================================================
-- Run: npx wrangler d1 execute bgindia-estates-db --file=scripts/migrate-rubber-register.sql --remote
-- (Use the ESTATES database binding — same DB the rubber_production table lives in.)
--
-- Matches the physical MULLATHOTTAM register: Block/Section per day,
-- Rain (Y/N) per day, Tapping Rate captured once per tapper and stamped on
-- each row (rate changes over time — stamping preserves history).
-- Total charge per day is DERIVED (tree_count * tapping_rate), never stored.
-- Day classification for monthly reporting:
--   rain = 1                          -> no tapping (rain day)
--   trees > 0 AND sheets > 0          -> tapping day
--   trees > 0 AND sheets = 0          -> maintenance / prep day
ALTER TABLE rubber_production ADD COLUMN block TEXT;                    -- 'A' | 'B' | 'AB' | NULL
ALTER TABLE rubber_production ADD COLUMN rain INTEGER DEFAULT 0;        -- 1 = rain-affected, no tapping
ALTER TABLE rubber_production ADD COLUMN tapping_rate REAL DEFAULT 0;   -- Rs per tree, e.g. 2.75
