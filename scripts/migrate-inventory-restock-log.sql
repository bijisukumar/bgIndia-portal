-- ── INVENTORY RESTOCK LOG ───────────────────────────────────
-- Transaction history for inventory restocks (qty bought, total cost, date)
-- Separate from `inventory.qty_in_stock` which only holds the current snapshot.
CREATE TABLE IF NOT EXISTS inventory_restock_log (
  id             TEXT PRIMARY KEY,
  villa_id       TEXT NOT NULL DEFAULT 'dwarka',
  item_id        TEXT REFERENCES inventory(item_id),
  item_name      TEXT,
  qty_bought     REAL NOT NULL DEFAULT 0,
  total_cost     REAL NOT NULL DEFAULT 0,
  price_per_unit REAL DEFAULT 0,
  -- Audit
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_restock_log_villa_item
  ON inventory_restock_log(villa_id, item_id);
