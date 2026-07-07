-- ============================================================================
-- EXPENSE CATEGORIES — per-villa configurable list (villa_settings)
-- ============================================================================
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/seed-expense-categories.sql --remote
--
-- Seeds the DEFAULT category list (now incl. 'Housekeeping Supplies' and
-- 'Kitchen Supplies') for dwarka as villa_settings key 'expense_categories'
-- (JSON array). INSERT OR IGNORE — never clobbers a customized list.
--
-- The expense screen dropdown AND the receipt-OCR category matcher both read
-- this key (falling back to the same built-in default), so onboarding a new
-- villa or changing the list needs NO code change — just update this row:
--
--   via API:  action=saveVillaSetting
--             body: { villaId, key: 'expense_categories', value: '[...]' }
--   via SQL:  UPDATE villa_settings SET value = '[...]'
--             WHERE villa_id = '<villa>' AND key = 'expense_categories';
--
-- Reporting is category-agnostic (history filters derive from actual
-- transactions; the P&L box sums all expense rows), so removing a category
-- never breaks history — old transactions keep their stored category text.

INSERT OR IGNORE INTO villa_settings (villa_id, key, value, updated_by, updated_at)
VALUES (
  'dwarka',
  'expense_categories',
  '["Electricity","Maintenance","Repairs","Laundry","Deep Cleaning","Housekeeping Supplies","Pest Control (Mosquito & Bats)","Kitchen Crockery","Kitchen Supplies","Appliance / AC Service","Landscaping","Painting","Water Filtration System","Water System — Motor & Associated","Bulk Purchases (Soap, Shampoo, Body Wash etc.)","Other"]',
  'system',
  datetime('now')
);
