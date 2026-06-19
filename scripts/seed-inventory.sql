-- ── SEED: inventory master items for dwarka ─────────────────
-- Idempotent — safe to re-run. Uses INSERT OR IGNORE so it never
-- overwrites prices/stock you've already edited.
INSERT OR IGNORE INTO inventory (item_id, villa_id, name, unit, category, qty_in_stock, cost_price, sell_price, created_by, updated_by)
VALUES
  ('water_bottle',       'dwarka', 'Water bottles',         'bottle', 'kitchen',  10, 18, 30, 'system', 'system'),
  ('soft_drink',         'dwarka', 'Soft drinks',           'can',    'kitchen',  10, 40, 60, 'system', 'system'),
  ('chocolate',          'dwarka', 'Chocolates',            'bar',    'kitchen',  10, 45, 70, 'system', 'system'),
  ('chips',              'dwarka', 'Chips',                 'packet', 'kitchen',  10, 30, 50, 'system', 'system'),
  ('milk_packet',        'dwarka', 'Milk packets',          'packet', 'kitchen',  10, 30, 45, 'system', 'system'),
  ('tea_coffee',         'dwarka', 'Tea / Coffee',          'cup',    'kitchen',  10, 15, 25, 'system', 'system'),
  ('eggs',               'dwarka', 'Eggs',                  'egg',    'kitchen',  10, 8,  12, 'system', 'system'),
  ('bread',              'dwarka', 'Bread',                 'loaf',   'kitchen',  10, 35, 45, 'system', 'system'),
  ('shampoo',            'dwarka', 'Shampoo',               'bottle', 'bathroom', 10, 80, 0,  'system', 'system'),
  ('body_wash',          'dwarka', 'Body wash',             'bottle', 'bathroom', 10, 90, 0,  'system', 'system'),
  ('bathroom_cleaner',   'dwarka', 'Bathroom cleaner',      'bottle', 'bathroom', 10, 60, 0,  'system', 'system'),
  ('tissue',             'dwarka', 'Tissue / toilet paper', 'roll',   'bathroom', 10, 25, 0,  'system', 'system'),
  ('bed_essential',      'dwarka', 'Bedroom essentials',    'set',    'bedroom',  10, 0,  0,  'system', 'system');
