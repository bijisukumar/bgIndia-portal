-- ============================================================================
-- ROLLBACK — RELEASE 2.1 — TABLE NAMESPACE: estate360_
-- ============================================================================
-- Run: npx wrangler d1 execute bgindiadb-estates --file=scripts/rollback-v2.1-namespace-estate360.sql --remote
-- ============================================================================

ALTER TABLE estate360_coconut_harvests    RENAME TO coconut_harvests;
ALTER TABLE estate360_estate_contacts     RENAME TO estate_contacts;
ALTER TABLE estate360_estate_managers     RENAME TO estate_managers;
ALTER TABLE estate360_estate_transactions RENAME TO estate_transactions;
ALTER TABLE estate360_fertilization_log   RENAME TO fertilization_log;
ALTER TABLE estate360_irrigation_logs     RENAME TO irrigation_logs;
ALTER TABLE estate360_irrigation_zones    RENAME TO irrigation_zones;
ALTER TABLE estate360_manager_settlements RENAME TO manager_settlements;
ALTER TABLE estate360_mango_harvests      RENAME TO mango_harvests;
ALTER TABLE estate360_rubber_harvests     RENAME TO rubber_harvests;
ALTER TABLE estate360_rubber_production   RENAME TO rubber_production;

DROP INDEX estate360_idx_coconut_date;
CREATE INDEX idx_coconut_date ON coconut_harvests(harvest_date);
DROP INDEX estate360_idx_coconut_estate;
CREATE INDEX idx_coconut_estate ON coconut_harvests(estate_id, harvest_date);

DROP INDEX estate360_idx_contacts_estate;
CREATE INDEX idx_contacts_estate ON estate_contacts(estate, category);

DROP INDEX estate360_idx_estate_txn;
CREATE INDEX idx_estate_txn ON estate_transactions(estate, date DESC);
DROP INDEX estate360_idx_estate_txn_date;
CREATE INDEX idx_estate_txn_date ON estate_transactions(estate, date DESC);
DROP INDEX estate360_idx_estate_txn_type;
CREATE INDEX idx_estate_txn_type ON estate_transactions(estate, type, date DESC);

DROP INDEX estate360_idx_fert_estate;
CREATE INDEX idx_fert_estate ON fertilization_log(estate, planned_date DESC);

DROP INDEX estate360_idx_irrigation_date;
CREATE INDEX idx_irrigation_date ON irrigation_logs(estate, logged_date DESC);
DROP INDEX estate360_idx_irrigation_zone;
CREATE INDEX idx_irrigation_zone ON irrigation_logs(estate, zone_id, logged_date DESC);

DROP INDEX estate360_idx_zones_estate;
CREATE INDEX idx_zones_estate ON irrigation_zones(estate, active);

DROP INDEX estate360_idx_mgr_settle_estate_date;
CREATE INDEX idx_mgr_settle_estate_date ON manager_settlements(estate_id, payment_date DESC);

DROP INDEX estate360_idx_mango_date;
CREATE INDEX idx_mango_date ON mango_harvests(estate, harvest_date DESC);

DROP INDEX estate360_idx_rubber_date;
CREATE INDEX idx_rubber_date ON rubber_harvests(harvest_date);
DROP INDEX estate360_idx_rubber_estate;
CREATE INDEX idx_rubber_estate ON rubber_harvests(estate_id, harvest_date);

DROP INDEX estate360_idx_rubber_prod_date;
CREATE INDEX idx_rubber_prod_date ON rubber_production(estate_id, prod_date DESC);
DROP INDEX estate360_idx_rubber_prod_unique;
CREATE UNIQUE INDEX idx_rubber_prod_unique ON rubber_production(estate_id, worker_name, prod_date);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'estate360_%';  -- should be empty
