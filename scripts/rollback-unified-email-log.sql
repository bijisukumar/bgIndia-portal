-- Rollback for migrate-unified-email-log.sql
-- SQLite/D1 can't DROP COLUMN pre-3.35 semantics safely in all cases,
-- but D1 supports it — straightforward drop, no data migration needed
-- since both new columns are additive with safe defaults.

DROP INDEX IF EXISTS infra_idx_alert_log_category;
ALTER TABLE infra_alert_log DROP COLUMN category;
ALTER TABLE platform_tenants DROP COLUMN email_retention_days;
