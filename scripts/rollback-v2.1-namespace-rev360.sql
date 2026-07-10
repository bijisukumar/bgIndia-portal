-- ============================================================================
-- ROLLBACK — RELEASE 2.1 — TABLE NAMESPACE: rev360_
-- ============================================================================
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/rollback-v2.1-namespace-rev360.sql --remote
-- ============================================================================

-- ── TABLE RENAMES (reverse) ─────────────────────────────────────
ALTER TABLE rev360_hoa_history        RENAME TO hoa_history;
ALTER TABLE rev360_incoming_tenants   RENAME TO incoming_tenants;
ALTER TABLE rev360_lease_losses       RENAME TO lease_losses;
ALTER TABLE rev360_maintenance_events RENAME TO maintenance_events;
ALTER TABLE rev360_property_details   RENAME TO property_details;
ALTER TABLE rev360_property_documents RENAME TO property_documents;
ALTER TABLE rev360_property_expenses  RENAME TO property_expenses;
ALTER TABLE rev360_rent_transactions  RENAME TO rent_transactions;
ALTER TABLE rev360_rental_income      RENAME TO rental_income;
ALTER TABLE rev360_rental_props       RENAME TO rental_props;
ALTER TABLE rev360_tax_history        RENAME TO tax_history;
ALTER TABLE rev360_tenancy_history    RENAME TO tenancy_history;

-- ── INDEX RENAMES (reverse) ─────────────────────────────────────
DROP INDEX rev360_idx_hoa_history_prop;
CREATE INDEX idx_hoa_history_prop ON hoa_history(prop_id, effective_date DESC);

DROP INDEX rev360_idx_incoming_tenant_one_per_prop;
CREATE UNIQUE INDEX idx_incoming_tenant_one_per_prop ON incoming_tenants(prop_id);

DROP INDEX rev360_idx_lease_losses_prop;
CREATE INDEX idx_lease_losses_prop ON lease_losses(prop_id, status);

DROP INDEX rev360_idx_maintenance_events_prop_period;
CREATE INDEX idx_maintenance_events_prop_period ON maintenance_events(prop_id, year, month);

DROP INDEX rev360_idx_property_docs_prop;
CREATE INDEX idx_property_docs_prop ON property_documents(prop_id, category);

DROP INDEX rev360_idx_property_expenses_prop;
CREATE INDEX idx_property_expenses_prop ON property_expenses(prop_id, year, month);

DROP INDEX rev360_idx_rent_txn_period;
CREATE INDEX idx_rent_txn_period ON rent_transactions(period_month);
DROP INDEX rev360_idx_rent_txn_prop;
CREATE INDEX idx_rent_txn_prop ON rent_transactions(prop_id, period_month);
DROP INDEX rev360_idx_rent_txn_unique_period;
CREATE UNIQUE INDEX idx_rent_txn_unique_period ON rent_transactions(prop_id, period_month, unit_type);

DROP INDEX rev360_idx_rental_income;
CREATE INDEX idx_rental_income ON rental_income(prop_id, year, month);

DROP INDEX rev360_idx_tax_history_prop;
CREATE INDEX idx_tax_history_prop ON tax_history(prop_id, tax_year DESC);

DROP INDEX rev360_idx_tenancy_history_prop;
CREATE INDEX idx_tenancy_history_prop ON tenancy_history(prop_id, lease_end);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rev360_%';  -- should be empty
