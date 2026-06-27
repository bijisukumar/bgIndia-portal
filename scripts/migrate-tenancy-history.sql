-- Migration: create tenancy_history
--
-- rental_props holds exactly ONE tenant record per property (current
-- state only — one tenant_name, one lease_start/end, etc). This was
-- fine until a real need came up: Pinnacle has a tenant living there
-- TODAY, and the owner separately wants to record a PAST tenant's
-- full details for historic reference. rental_props has no second
-- slot for that — saving one would overwrite the other.
--
-- tenancy_history fixes this by being a proper one-to-many: many
-- historic tenancy rows can exist per prop_id, independent of
-- whatever's currently live in rental_props. It mirrors every
-- tenant-specific field already on rental_props (deliberately
-- duplicated rather than referencing rental_props' current columns,
-- since a historic record must stay fixed even if rental_props later
-- changes for the next tenant).
--
-- This does NOT touch rental_props' current single-tenant behavior —
-- that keeps working exactly as before for the live/active tenant.
-- tenancy_history is purely an ADDITIONAL place to file away past
-- tenants, populated either by hand (back-filling old records) or via
-- the new "Archive current tenant" action when a live tenancy ends.
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

CREATE TABLE IF NOT EXISTS tenancy_history (
  history_id      TEXT PRIMARY KEY,
  prop_id         TEXT NOT NULL,
  tenant_name     TEXT NOT NULL,
  tenant_email    TEXT,
  tenant_phone    TEXT,
  tenant_address  TEXT,
  tenant_pan      TEXT,
  deposit         REAL DEFAULT 0,
  agreed_rent     REAL DEFAULT 0,
  maintenance_fee REAL DEFAULT 0,
  lease_start     TEXT,
  lease_end       TEXT,
  country         TEXT DEFAULT 'IN',
  currency        TEXT DEFAULT 'INR',
  -- A historic record is always a finished tenancy, so status is fixed
  -- at 'Completed' — what matters is WHY it ended, captured in
  -- end_reason (same vocabulary as rental_props.end_reason, added in
  -- migrate-rental-props-lifecycle-v2.sql): 'Lease Ended' / 'Early
  -- Termination' / 'Evicted' / 'Runaway' / 'After Delinquency'.
  status          TEXT DEFAULT 'Completed',
  end_reason      TEXT,
  early_terminated INTEGER DEFAULT 0,
  early_termination_date TEXT,
  notes           TEXT,
  drive_folder_url TEXT,
  doc_contract_signed INTEGER DEFAULT 0,
  doc_id_captured     INTEGER DEFAULT 0,
  doc_move_in         INTEGER DEFAULT 0,
  doc_move_out        INTEGER DEFAULT 0,
  doc_damage_report   INTEGER DEFAULT 0,
  created_by      TEXT DEFAULT 'owner',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_by      TEXT DEFAULT 'owner',
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenancy_history_prop ON tenancy_history(prop_id, lease_end);

-- Verify after running:
-- PRAGMA table_info(tenancy_history);
-- SELECT * FROM tenancy_history;
