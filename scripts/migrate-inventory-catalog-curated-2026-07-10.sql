-- ============================================================================
-- INVENTORY: curated 11-item catalog, GST defaults, sort order (dwarka)
-- ============================================================================
-- Reconciliation of the live 13-item catalog against the owner's target
-- list. Archiving is soft-delete (active=0) — reversible, and confirmed
-- via a read-only check (2026-07-10) that none of the 5 archived items
-- have any restock-log or incidental history, so nothing is at risk.
-- tea_coffee is archived rather than split — its history can't be
-- retroactively divided into tea vs coffee, so Tea/Coffee powder start
-- fresh as new items with 0 stock.
--
-- *** SAFETY: before running the archive statements against production,
-- *** re-run this check yourself and confirm all five are still 0:
-- SELECT
--   (SELECT COUNT(*) FROM stayvibe_inventory_restock_log WHERE item_id IN ('tissue','bed_essential','bread','eggs','tea_coffee')) AS restock_refs,
--   (SELECT COUNT(*) FROM stayvibe_incidentals WHERE inv_item_id IN ('tissue','bed_essential','bread','eggs','tea_coffee')) AS incidental_refs;
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-inventory-catalog-curated-2026-07-10.sql --remote
-- ============================================================================

-- ── RENAMES (keep item_id + history, update display name) ──────────────
UPDATE stayvibe_inventory SET name = 'Milk',           gst_pct = 0,  sort_order = 1  WHERE item_id = 'milk_packet'  AND villa_id = 'dwarka';
UPDATE stayvibe_inventory SET name = 'Bottled water',  gst_pct = 5,  sort_order = 2  WHERE item_id = 'water_bottle' AND villa_id = 'dwarka';

-- ── KEEP (same item_id/name, set gst_pct + sort_order) ──────────────────
UPDATE stayvibe_inventory SET gst_pct = 5,  sort_order = 6  WHERE item_id = 'chips'            AND villa_id = 'dwarka';
UPDATE stayvibe_inventory SET gst_pct = 18, sort_order = 7  WHERE item_id = 'chocolate'         AND villa_id = 'dwarka';
UPDATE stayvibe_inventory SET gst_pct = 5,  sort_order = 8  WHERE item_id = 'shampoo'           AND villa_id = 'dwarka';
UPDATE stayvibe_inventory SET gst_pct = 18, sort_order = 9  WHERE item_id = 'body_wash'         AND villa_id = 'dwarka';
UPDATE stayvibe_inventory SET gst_pct = 18, sort_order = 10 WHERE item_id = 'bathroom_cleaner'  AND villa_id = 'dwarka';
UPDATE stayvibe_inventory SET gst_pct = 40, sort_order = 11 WHERE item_id = 'soft_drink'        AND villa_id = 'dwarka';

-- ── ARCHIVE (soft-delete — off the new list, history stays intact) ──────
UPDATE stayvibe_inventory SET active = 0 WHERE item_id IN ('tea_coffee','tissue','bed_essential','bread','eggs') AND villa_id = 'dwarka';

-- ── CREATE (brand new items, start at 0 stock) ──────────────────────────
INSERT INTO stayvibe_inventory (item_id, villa_id, name, unit, category, qty_in_stock, cost_price, sell_price, gst_pct, sort_order, active, created_by, updated_by, created_at, updated_at)
VALUES
  ('tea_powder',    'dwarka', 'Tea powder',    'packet', 'kitchen', 0, 0, 0, 5, 3, 1, 'system', 'system', datetime('now'), datetime('now')),
  ('coffee_powder', 'dwarka', 'Coffee powder', 'packet', 'kitchen', 0, 0, 0, 5, 4, 1, 'system', 'system', datetime('now'), datetime('now')),
  ('sugar',         'dwarka', 'Sugar',         'kg',     'kitchen', 0, 0, 0, 5, 5, 1, 'system', 'system', datetime('now'), datetime('now'));

-- ── VERIFY ──────────────────────────────────────────────────────────────
SELECT item_id, name, category, gst_pct, sort_order, active
  FROM stayvibe_inventory WHERE villa_id = 'dwarka' ORDER BY sort_order, name;
