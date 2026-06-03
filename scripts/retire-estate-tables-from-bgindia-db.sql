-- ============================================================
-- Run in D1 console: bgindia-db (main DB)
-- Retires estate tables that have been moved to bgindiadb-estates
-- Safe to run AFTER confirming bgindiadb-estates is working
--
-- Verify first:
--   SELECT COUNT(*) FROM coconut_harvests;  -- in bgindiadb-estates
--   SELECT COUNT(*) FROM irrigation_logs;   -- in bgindiadb-estates
-- Then run this file against bgindia-db
-- ============================================================

DROP TABLE IF EXISTS irrigation_logs;
DROP TABLE IF EXISTS estate_transactions;
DROP TABLE IF EXISTS rubber_harvests;
DROP TABLE IF EXISTS coconut_harvests;
