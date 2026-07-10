-- ============================================================================
-- RELEASE 2.1 — TABLE NAMESPACE: estate360_ (11 tables, bgindiadb-estates)
-- ============================================================================
-- *** DO NOT RUN until the worker SQL rewrite (functions/api/[[route]].js)
-- *** targeting these new names has landed and deployed. Estate actions
-- *** already route through ActiveDB -> DB_ESTATES, so this migration is
-- *** entirely within bgindiadb-estates, but the worker's SQL strings still
-- *** need the new names before this runs.
--
-- Run: npx wrangler d1 execute bgindiadb-estates --file=scripts/migrate-v2.1-namespace-estate360.sql --remote
-- Rollback: scripts/rollback-v2.1-namespace-estate360.sql
--
-- Note: estate_transactions has two indexes with identical definitions
-- today (idx_estate_txn and idx_estate_txn_date, both
-- ON estate_transactions(estate, date DESC)) — a pre-existing duplicate,
-- out of scope to fix here; both carried forward under new names as-is.
-- estate_managers has no indexes (verified live) — none to rename.
-- ============================================================================

-- ── TABLE RENAMES ──────────────────────────────────────────────
ALTER TABLE coconut_harvests    RENAME TO estate360_coconut_harvests;
ALTER TABLE estate_contacts     RENAME TO estate360_estate_contacts;
ALTER TABLE estate_managers     RENAME TO estate360_estate_managers;
ALTER TABLE estate_transactions RENAME TO estate360_estate_transactions;
ALTER TABLE fertilization_log   RENAME TO estate360_fertilization_log;
ALTER TABLE irrigation_logs     RENAME TO estate360_irrigation_logs;
ALTER TABLE irrigation_zones    RENAME TO estate360_irrigation_zones;
ALTER TABLE manager_settlements RENAME TO estate360_manager_settlements;
ALTER TABLE mango_harvests      RENAME TO estate360_mango_harvests;
ALTER TABLE rubber_harvests     RENAME TO estate360_rubber_harvests;
ALTER TABLE rubber_production   RENAME TO estate360_rubber_production;

-- ── INDEX RENAMES ────────────────────────────────────────────────
DROP INDEX idx_coconut_date;
CREATE INDEX estate360_idx_coconut_date ON estate360_coconut_harvests(harvest_date);
DROP INDEX idx_coconut_estate;
CREATE INDEX estate360_idx_coconut_estate ON estate360_coconut_harvests(estate_id, harvest_date);

DROP INDEX idx_contacts_estate;
CREATE INDEX estate360_idx_contacts_estate ON estate360_estate_contacts(estate, category);

DROP INDEX idx_estate_txn;
CREATE INDEX estate360_idx_estate_txn ON estate360_estate_transactions(estate, date DESC);
DROP INDEX idx_estate_txn_date;
CREATE INDEX estate360_idx_estate_txn_date ON estate360_estate_transactions(estate, date DESC);
DROP INDEX idx_estate_txn_type;
CREATE INDEX estate360_idx_estate_txn_type ON estate360_estate_transactions(estate, type, date DESC);

DROP INDEX idx_fert_estate;
CREATE INDEX estate360_idx_fert_estate ON estate360_fertilization_log(estate, planned_date DESC);

DROP INDEX idx_irrigation_date;
CREATE INDEX estate360_idx_irrigation_date ON estate360_irrigation_logs(estate, logged_date DESC);
DROP INDEX idx_irrigation_zone;
CREATE INDEX estate360_idx_irrigation_zone ON estate360_irrigation_logs(estate, zone_id, logged_date DESC);

DROP INDEX idx_zones_estate;
CREATE INDEX estate360_idx_zones_estate ON estate360_irrigation_zones(estate, active);

DROP INDEX idx_mgr_settle_estate_date;
CREATE INDEX estate360_idx_mgr_settle_estate_date ON estate360_manager_settlements(estate_id, payment_date DESC);

DROP INDEX idx_mango_date;
CREATE INDEX estate360_idx_mango_date ON estate360_mango_harvests(estate, harvest_date DESC);

DROP INDEX idx_rubber_date;
CREATE INDEX estate360_idx_rubber_date ON estate360_rubber_harvests(harvest_date);
DROP INDEX idx_rubber_estate;
CREATE INDEX estate360_idx_rubber_estate ON estate360_rubber_harvests(estate_id, harvest_date);

DROP INDEX idx_rubber_prod_date;
CREATE INDEX estate360_idx_rubber_prod_date ON estate360_rubber_production(estate_id, prod_date DESC);
DROP INDEX idx_rubber_prod_unique;
CREATE UNIQUE INDEX estate360_idx_rubber_prod_unique ON estate360_rubber_production(estate_id, worker_name, prod_date);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'estate360_%' ORDER BY name;
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'estate360_%' ORDER BY name;
