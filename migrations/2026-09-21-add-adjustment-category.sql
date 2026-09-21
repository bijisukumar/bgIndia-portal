-- Adds 'Adjustment' as a valid rev360_lease_losses.item_category, for
-- non-repair move-out settlement items (unpaid electric/gas/maintenance
-- dues) as distinct from Damage/Cleaning repair claims.
--
-- SQLite can't ALTER a CHECK constraint in place, so this rebuilds the
-- table: copy rows into a new table with the updated CHECK, drop the old
-- one, rename the new one back, recreate the index. No FK references
-- rev360_lease_losses, so unlike demovilla-parity.sql this needs no
-- park-and-restore step for dependent rows.

CREATE TABLE rev360_lease_losses_new (
  loss_id            TEXT PRIMARY KEY,
  prop_id            TEXT REFERENCES rev360_rental_props(prop_id),
  lease_snapshot     TEXT,
  item_category      TEXT NOT NULL CHECK(item_category IN ('Rent','Damage','Cleaning','Legal','Adjustment','Other')),
  description        TEXT NOT NULL,
  amount             REAL NOT NULL DEFAULT 0,
  currency           TEXT DEFAULT 'INR',
  evidence_file_name TEXT,
  evidence_drive_url TEXT,
  evidence_timestamp TEXT,
  status             TEXT DEFAULT 'Estimated' CHECK(status IN ('Estimated','Claimed','Recovered','Unrecoverable')),
  created_by         TEXT DEFAULT 'owner',
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now'))
);

INSERT INTO rev360_lease_losses_new SELECT * FROM rev360_lease_losses;

DROP TABLE rev360_lease_losses;

ALTER TABLE rev360_lease_losses_new RENAME TO rev360_lease_losses;

CREATE INDEX IF NOT EXISTS rev360_idx_lease_losses_prop ON rev360_lease_losses(prop_id, status);
