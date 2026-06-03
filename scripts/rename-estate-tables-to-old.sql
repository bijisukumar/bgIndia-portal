-- ============================================================
-- Run against bgindia-db AFTER confirming counts match
-- Only coconut_harvests and rubber_harvests exist here.
-- estate_transactions and irrigation_logs were never in bgindia-db.
-- ============================================================

ALTER TABLE coconut_harvests RENAME TO coconut_harvests_old;
ALTER TABLE rubber_harvests  RENAME TO rubber_harvests_old;
