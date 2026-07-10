-- ============================================================================
-- RELEASE 2.1 — TABLE NAMESPACE: infra_ (cross-cutting logs, 3 tables)
-- ============================================================================
-- *** DO NOT RUN until the worker SQL rewrite (functions/api/[[route]].js)
-- *** targeting these new names has landed and deployed.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-v2.1-namespace-infra.sql --remote
-- Rollback: scripts/rollback-v2.1-namespace-infra.sql
--
-- tenants/auth_tokens moved to their own platform_ namespace — see
-- scripts/migrate-v2.1-namespace-platform.sql — since they're SaaS tenancy
-- identity, not shared logging/audit infrastructure like the 3 tables here.
-- ============================================================================

-- ── TABLE RENAMES ──────────────────────────────────────────────
ALTER TABLE alert_log      RENAME TO infra_alert_log;
ALTER TABLE deletion_log   RENAME TO infra_deletion_log;
ALTER TABLE processing_log RENAME TO infra_processing_log;

-- ── INDEX RENAMES ────────────────────────────────────────────────
DROP INDEX idx_alert_log_created;
CREATE INDEX infra_idx_alert_log_created ON infra_alert_log(created_at DESC);

DROP INDEX idx_deletion_log_stay;
CREATE INDEX infra_idx_deletion_log_stay ON infra_deletion_log(stay_id);
DROP INDEX idx_deletion_log_villa;
CREATE INDEX infra_idx_deletion_log_villa ON infra_deletion_log(villa_id);

DROP INDEX idx_processing_log_created;
CREATE INDEX infra_idx_processing_log_created ON infra_processing_log(created_at);
DROP INDEX idx_processing_log_stay;
CREATE INDEX infra_idx_processing_log_stay ON infra_processing_log(stay_id);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'infra_%' ORDER BY name;
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'infra_%' ORDER BY name;
