-- Two independent fixes:
--
-- 1. "Post Advance & Generate Receipt" only ever generated a document --
--    nothing was persisted, so a refresh silently lost whatever the
--    owner typed in. rev360_advances gives it a real ledger.
--
-- 2. rev360_rental_props.tenant_pays_maintenance_direct: when set, the
--    tenant pays maintenance straight to the association (e.g. Tritvam)
--    rather than through the owner, so getRentalDashboard/
--    getRev360Dashboard must exclude the maintenance portion of
--    total_due from income for that property.
CREATE TABLE IF NOT EXISTS rev360_advances (
  advance_id   TEXT PRIMARY KEY,
  prop_id      TEXT NOT NULL REFERENCES rev360_rental_props(prop_id),
  amount       REAL NOT NULL DEFAULT 0,
  currency     TEXT DEFAULT 'INR',
  paid_date    TEXT NOT NULL,
  payment_mode TEXT DEFAULT 'Bank Transfer',
  notes        TEXT,
  created_by   TEXT DEFAULT 'owner',
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS rev360_idx_advances_prop ON rev360_advances(prop_id, paid_date DESC);

ALTER TABLE rev360_rental_props ADD COLUMN tenant_pays_maintenance_direct INTEGER DEFAULT 0;
