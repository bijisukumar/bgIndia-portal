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
