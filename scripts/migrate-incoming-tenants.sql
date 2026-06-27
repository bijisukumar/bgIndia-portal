-- Migration: create incoming_tenants
--
-- Mirrors the gap tenancy_history solved for the PAST, but for the
-- FUTURE: a property can have a live tenant (e.g. on Notice Given)
-- while a NEW tenant has already signed paperwork and is queued to
-- move in once the current one leaves. rental_props has only one
-- slot — filling it in now for the incoming tenant would either
-- overwrite the live tenant's data, or falsely flip the property's
-- stage to 'Signed Up' while the live tenant's full record is still
-- sitting on that same row.
--
-- incoming_tenants holds the new tenant's full intake data
-- (everything tenancy_history captures) completely separately. A
-- "Move In" action (backend: moveInIncomingTenant) does the actual
-- swap atomically when the day comes:
--   1. archive the CURRENT rental_props row into tenancy_history
--   2. overwrite rental_props with the incoming tenant's data,
--      stage='Active'
--   3. delete the now-consumed incoming_tenants row
--
-- AT MOST ONE incoming tenant per property at a time — enforced by a
-- UNIQUE index on prop_id, not a free list. Two different people both
-- queued for the same unit is a scheduling conflict to resolve by
-- hand, not a data state this app should silently allow.
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

CREATE TABLE IF NOT EXISTS incoming_tenants (
  incoming_id     TEXT PRIMARY KEY,
  prop_id         TEXT NOT NULL,
  tenant_name     TEXT NOT NULL,
  tenant_email    TEXT,
  tenant_phone    TEXT,
  tenant_address  TEXT,
  tenant_pan      TEXT,
  deposit         REAL DEFAULT 0,
  agreed_rent     REAL DEFAULT 0,
  maintenance_fee REAL DEFAULT 0,
  lease_start     TEXT,   -- planned move-in date
  lease_end       TEXT,   -- planned lease end, once they move in
  country         TEXT DEFAULT 'IN',
  currency        TEXT DEFAULT 'INR',
  notes           TEXT,
  doc_contract_signed INTEGER DEFAULT 0,
  doc_id_captured     INTEGER DEFAULT 0,
  created_by      TEXT DEFAULT 'owner',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_by      TEXT DEFAULT 'owner',
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incoming_tenant_one_per_prop ON incoming_tenants(prop_id);

-- Verify after running:
-- PRAGMA table_info(incoming_tenants);
-- SELECT * FROM incoming_tenants;
