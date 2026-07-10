-- ============================================================================
-- ROLLBACK — RELEASE 2.1 — TABLE NAMESPACE: infra_
-- ============================================================================
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/rollback-v2.1-namespace-infra.sql --remote
-- ============================================================================

ALTER TABLE infra_alert_log      RENAME TO alert_log;
ALTER TABLE infra_deletion_log   RENAME TO deletion_log;
ALTER TABLE infra_processing_log RENAME TO processing_log;

DROP INDEX infra_idx_alert_log_created;
CREATE INDEX idx_alert_log_created ON alert_log(created_at DESC);

DROP INDEX infra_idx_deletion_log_stay;
CREATE INDEX idx_deletion_log_stay ON deletion_log(stay_id);
DROP INDEX infra_idx_deletion_log_villa;
CREATE INDEX idx_deletion_log_villa ON deletion_log(villa_id);

DROP INDEX infra_idx_processing_log_created;
CREATE INDEX idx_processing_log_created ON processing_log(created_at);
DROP INDEX infra_idx_processing_log_stay;
CREATE INDEX idx_processing_log_stay ON processing_log(stay_id);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'infra_%';  -- should be empty
