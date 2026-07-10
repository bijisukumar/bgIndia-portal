-- ============================================================================
-- RELEASE 2.1 — DROP STALE ESTATE TABLE COPIES FROM bgindia-db
-- ============================================================================
-- These 5 tables are leftover copies from the pre-split schema.sql. Estate
-- actions route through ActiveDB -> DB_ESTATES (bgindiadb-estates), which
-- has the real, current data for all 5 (verified live, this session).
-- These bgindia-db copies were confirmed 0 rows via direct query this
-- session (2026-07-09): coconut_harvests, estate_transactions,
-- manager_settlements, rubber_harvests, rubber_production.
--
-- *** SAFETY: re-run the COUNT check below yourself right before dropping.
-- *** If any count is non-zero, STOP — that means something wrote to the
-- *** stale copy since this was last verified, and the data needs to be
-- *** reconciled into bgindiadb-estates before dropping, not discarded.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-v2.1-drop-stale-estate-tables.sql --remote
-- Rollback: scripts/rollback-v2.1-drop-stale-estate-tables.sql (recreates
-- empty tables with the original schema — cannot restore dropped rows,
-- which is why the safety check above matters).
-- ============================================================================

-- ── SAFETY CHECK — run this block alone first if you have any doubt ──
-- SELECT
--   (SELECT COUNT(*) FROM coconut_harvests)    AS coconut_harvests_rows,
--   (SELECT COUNT(*) FROM estate_transactions) AS estate_transactions_rows,
--   (SELECT COUNT(*) FROM manager_settlements) AS manager_settlements_rows,
--   (SELECT COUNT(*) FROM rubber_harvests)     AS rubber_harvests_rows,
--   (SELECT COUNT(*) FROM rubber_production)   AS rubber_production_rows;
-- All must be 0 before proceeding.

DROP TABLE coconut_harvests;
DROP TABLE estate_transactions;
DROP TABLE manager_settlements;
DROP TABLE rubber_harvests;
DROP TABLE rubber_production;

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table'
  AND name IN ('coconut_harvests','estate_transactions','manager_settlements','rubber_harvests','rubber_production');
  -- should return zero rows
