-- ============================================================================
-- INVENTORY: GST% default + explicit display order, restock-log GST/rate
-- ============================================================================
-- gst_pct on stayvibe_inventory is the per-item DEFAULT shown on the
-- Restock tab (overwritable per transaction). sort_order lets the owner's
-- specific catalog ordering be expressed — getInventory has no ordering
-- concept beyond category+name today.
--
-- On the restock log: rate_per_unit (pre-tax, as entered) and gst_pct
-- (whatever was actually used for THAT purchase) are stored per-row so the
-- log reflects what was actually paid, not just today's item default.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-inventory-gst-and-sort-order.sql --remote
-- ============================================================================

ALTER TABLE stayvibe_inventory ADD COLUMN gst_pct REAL DEFAULT 0;
ALTER TABLE stayvibe_inventory ADD COLUMN sort_order INTEGER DEFAULT 999;

ALTER TABLE stayvibe_inventory_restock_log ADD COLUMN rate_per_unit REAL;
ALTER TABLE stayvibe_inventory_restock_log ADD COLUMN gst_pct REAL;

-- Verify
SELECT name FROM pragma_table_info('stayvibe_inventory') WHERE name IN ('gst_pct','sort_order');
SELECT name FROM pragma_table_info('stayvibe_inventory_restock_log') WHERE name IN ('rate_per_unit','gst_pct');
