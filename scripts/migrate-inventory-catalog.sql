-- Makes the inventory item catalog fully DB-driven instead of a hardcoded
-- frontend list (INVENTORY_MASTER in Inventory.jsx). Seeds the 13 items
-- that were previously baked into the frontend code, so existing
-- qty/price data already saved against these item_ids is untouched
-- (INSERT OR IGNORE — only fills in metadata for rows that don't already
-- exist).
--
-- The `active` column itself is added by
-- scripts/migrate-inventory-add-columns.sql — run that FIRST if you
-- haven't already, then run this one.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-inventory-catalog.sql --remote

INSERT OR IGNORE INTO inventory (item_id, villa_id, name, unit, category, cost_price, sell_price, preferred_stock, active, created_by, updated_by)
VALUES
  ('water_bottle',      'dwarka', 'Water bottles',           'bottle', 'kitchen',  18, 30, 10, 1, 'system', 'system'),
  ('soft_drink',        'dwarka', 'Soft drinks',             'can',    'kitchen',  40, 60, 10, 1, 'system', 'system'),
  ('chocolate',         'dwarka', 'Chocolates',              'bar',    'kitchen',  45, 70, 10, 1, 'system', 'system'),
  ('chips',             'dwarka', 'Chips',                   'packet', 'kitchen',  30, 50, 10, 1, 'system', 'system'),
  ('milk_packet',       'dwarka', 'Milk packets',            'packet', 'kitchen',  30, 45, 10, 1, 'system', 'system'),
  ('tea_coffee',        'dwarka', 'Tea / Coffee',            'cup',    'kitchen',  15, 25, 10, 1, 'system', 'system'),
  ('eggs',              'dwarka', 'Eggs',                    'egg',    'kitchen',  8,  12, 10, 1, 'system', 'system'),
  ('bread',             'dwarka', 'Bread',                   'loaf',   'kitchen',  35, 45, 10, 1, 'system', 'system'),
  ('shampoo',           'dwarka', 'Shampoo',                 'bottle', 'bathroom', 80, 0,  10, 1, 'system', 'system'),
  ('body_wash',         'dwarka', 'Body wash',                'bottle', 'bathroom', 90, 0,  10, 1, 'system', 'system'),
  ('bathroom_cleaner',  'dwarka', 'Bathroom cleaner',        'bottle', 'bathroom', 60, 0,  10, 1, 'system', 'system'),
  ('tissue',            'dwarka', 'Tissue / toilet paper',   'roll',   'bathroom', 25, 0,  10, 1, 'system', 'system'),
  ('bed_essential',     'dwarka', 'Bedroom essentials',      'set',    'bedroom',  0,  0,  10, 1, 'system', 'system');

-- Existing rows created before this migration have active = NULL (the
-- ALTER TABLE default only applies to new rows) — backfill them to 1 so
-- they don't disappear from the UI once active-filtering goes live.
UPDATE inventory SET active = 1 WHERE active IS NULL;
