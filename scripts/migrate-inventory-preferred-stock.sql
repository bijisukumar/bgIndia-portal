-- ── PREFERRED STOCK LEVELS ───────────────────────────────────
-- Lets the owner set a target stock level per item. Used to flag
-- "low stock" when qty_in_stock falls below 10% of preferred_stock.
ALTER TABLE inventory ADD COLUMN preferred_stock INTEGER DEFAULT 10;

-- Backfill existing rows to the current default qty (10) so the
-- threshold has a sane value immediately instead of comparing against 0.
UPDATE inventory SET preferred_stock = 10 WHERE preferred_stock IS NULL;
