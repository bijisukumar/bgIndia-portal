-- ============================================================================
-- RELEASE 2.1 — TABLE NAMESPACE: rev360_ (rental, 12 tables)
-- ============================================================================
-- *** DO NOT RUN until the worker SQL rewrite (functions/api/[[route]].js)
-- *** targeting these new names has landed and deployed. Running this against
-- *** production before that lands will break every rental action — the
-- *** currently-deployed worker still queries the OLD table names.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-v2.1-namespace-rev360.sql --remote
-- Rollback: scripts/rollback-v2.1-namespace-rev360.sql
-- ============================================================================

-- ── TABLE RENAMES ──────────────────────────────────────────────
ALTER TABLE hoa_history      RENAME TO rev360_hoa_history;
ALTER TABLE incoming_tenants RENAME TO rev360_incoming_tenants;
ALTER TABLE lease_losses     RENAME TO rev360_lease_losses;
ALTER TABLE maintenance_events RENAME TO rev360_maintenance_events;
ALTER TABLE property_details RENAME TO rev360_property_details;
ALTER TABLE property_documents RENAME TO rev360_property_documents;
ALTER TABLE property_expenses  RENAME TO rev360_property_expenses;
ALTER TABLE rent_transactions RENAME TO rev360_rent_transactions;
ALTER TABLE rental_income     RENAME TO rev360_rental_income;
ALTER TABLE rental_props      RENAME TO rev360_rental_props;
ALTER TABLE tax_history       RENAME TO rev360_tax_history;
ALTER TABLE tenancy_history   RENAME TO rev360_tenancy_history;

-- ── INDEX RENAMES ────────────────────────────────────────────────
DROP INDEX idx_hoa_history_prop;
CREATE INDEX rev360_idx_hoa_history_prop ON rev360_hoa_history(prop_id, effective_date DESC);

DROP INDEX idx_incoming_tenant_one_per_prop;
CREATE UNIQUE INDEX rev360_idx_incoming_tenant_one_per_prop ON rev360_incoming_tenants(prop_id);

DROP INDEX idx_lease_losses_prop;
CREATE INDEX rev360_idx_lease_losses_prop ON rev360_lease_losses(prop_id, status);

DROP INDEX idx_maintenance_events_prop_period;
CREATE INDEX rev360_idx_maintenance_events_prop_period ON rev360_maintenance_events(prop_id, year, month);

DROP INDEX idx_property_docs_prop;
CREATE INDEX rev360_idx_property_docs_prop ON rev360_property_documents(prop_id, category);

DROP INDEX idx_property_expenses_prop;
CREATE INDEX rev360_idx_property_expenses_prop ON rev360_property_expenses(prop_id, year, month);

DROP INDEX idx_rent_txn_period;
CREATE INDEX rev360_idx_rent_txn_period ON rev360_rent_transactions(period_month);
DROP INDEX idx_rent_txn_prop;
CREATE INDEX rev360_idx_rent_txn_prop ON rev360_rent_transactions(prop_id, period_month);
DROP INDEX idx_rent_txn_unique_period;
CREATE UNIQUE INDEX rev360_idx_rent_txn_unique_period ON rev360_rent_transactions(prop_id, period_month, unit_type);

DROP INDEX idx_rental_income;
CREATE INDEX rev360_idx_rental_income ON rev360_rental_income(prop_id, year, month);

DROP INDEX idx_tax_history_prop;
CREATE INDEX rev360_idx_tax_history_prop ON rev360_tax_history(prop_id, tax_year DESC);

DROP INDEX idx_tenancy_history_prop;
CREATE INDEX rev360_idx_tenancy_history_prop ON rev360_tenancy_history(prop_id, lease_end);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rev360_%' ORDER BY name;
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'rev360_%' ORDER BY name;
