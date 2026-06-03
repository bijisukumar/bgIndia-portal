-- ============================================================
-- Run against bgindia-db AFTER confirming counts match
-- in bgindiadb-estates. Renames to _old — safe fallback.
-- irrigation_logs was never in bgindia-db so not listed here.
-- ============================================================

ALTER TABLE coconut_harvests    RENAME TO coconut_harvests_old;
ALTER TABLE rubber_harvests     RENAME TO rubber_harvests_old;
ALTER TABLE estate_transactions RENAME TO estate_transactions_old;
