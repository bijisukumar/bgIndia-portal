-- ============================================================
-- Migration: Add location columns to stays table
-- Run once:
--   wrangler d1 execute bgindia-db \
--     --file=scripts/migrate-location-columns.sql --remote
-- ============================================================

ALTER TABLE stays ADD COLUMN home_address TEXT;
ALTER TABLE stays ADD COLUMN city         TEXT;
ALTER TABLE stays ADD COLUMN state        TEXT;
ALTER TABLE stays ADD COLUMN country      TEXT DEFAULT 'India';
ALTER TABLE stays ADD COLUMN from_city    TEXT;

-- ── STALE DATA REPORT ─────────────────────────────────────────────────────
-- Shows how much data is missing location info.
-- Run anytime to check completeness.
SELECT
  COUNT(*)                                          AS total_stays,
  SUM(CASE WHEN from_city IS NULL OR from_city = '' THEN 1 ELSE 0 END) AS missing_city,
  SUM(CASE WHEN state     IS NULL OR state     = '' THEN 1 ELSE 0 END) AS missing_state,
  SUM(CASE WHEN country   IS NULL OR country   = '' THEN 1 ELSE 0 END) AS missing_country,
  ROUND(100.0 * SUM(CASE WHEN from_city IS NULL OR from_city = '' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_missing_city
FROM stays
WHERE status NOT IN ('cancelled');
