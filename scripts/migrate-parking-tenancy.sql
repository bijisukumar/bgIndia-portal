-- Migration: Carpark as a separate sub-tenancy on a property
-- Adds parking columns to rental_props and unit_type to rent_transactions
-- Run: npx wrangler d1 execute bgindia-db --remote --file=scripts/migrate-parking-tenancy.sql

-- 1. Parking sub-tenancy fields on the property
ALTER TABLE rental_props ADD COLUMN parking_tenant_name  TEXT;
ALTER TABLE rental_props ADD COLUMN parking_tenant_phone TEXT;
ALTER TABLE rental_props ADD COLUMN parking_fee          REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN parking_deposit      REAL DEFAULT 0;
ALTER TABLE rental_props ADD COLUMN parking_lease_start  TEXT;   -- YYYY-MM-DD
ALTER TABLE rental_props ADD COLUMN parking_lease_end    TEXT;   -- YYYY-MM-DD  (30-day alert threshold)
ALTER TABLE rental_props ADD COLUMN parking_currency     TEXT DEFAULT 'INR';
ALTER TABLE rental_props ADD COLUMN has_separate_parking INTEGER DEFAULT 0; -- toggle per property

-- 2. unit_type on rent_transactions so parking rows don't collide with main rent rows
ALTER TABLE rent_transactions ADD COLUMN unit_type TEXT NOT NULL DEFAULT 'main';

-- 3. Drop old unique index (prop_id, period_month) and replace with one that includes unit_type
DROP INDEX IF EXISTS idx_rent_txn_unique_period;
CREATE UNIQUE INDEX idx_rent_txn_unique_period ON rent_transactions(prop_id, period_month, unit_type);

-- Verify:
-- PRAGMA table_info(rental_props);
-- PRAGMA table_info(rent_transactions);
-- SELECT name FROM sqlite_master WHERE type='index' AND name='idx_rent_txn_unique_period';
