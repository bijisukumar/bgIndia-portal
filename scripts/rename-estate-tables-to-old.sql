-- ============================================================
-- Run against bgindia-db AFTER data is confirmed in bgindiadb-estates
-- Renames estate tables to _old (safe fallback, not a DROP)
-- ============================================================

ALTER TABLE coconut_harvests    RENAME TO coconut_harvests_old;
ALTER TABLE rubber_harvests     RENAME TO rubber_harvests_old;
ALTER TABLE estate_transactions RENAME TO estate_transactions_old;
ALTER TABLE irrigation_logs     RENAME TO irrigation_logs_old;
