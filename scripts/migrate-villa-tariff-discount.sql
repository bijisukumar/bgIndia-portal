-- MIGRATION: villa rate card + enquiry guest-breakdown / discount-category columns
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-villa-tariff-discount.sql --remote

-- 1. Villa rate card table (per-night tariff by villa + billable guest count)
CREATE TABLE IF NOT EXISTS villa_rate_cards (
  villa_id      TEXT NOT NULL DEFAULT 'dwarka',
  guest_count   INTEGER NOT NULL,
  tariff_per_night REAL NOT NULL,
  created_by  TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT 'owner',
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (villa_id, guest_count)
);

INSERT OR IGNORE INTO villa_rate_cards (villa_id, guest_count, tariff_per_night) VALUES
  ('dwarka', 1, 4896), ('dwarka', 2, 4896), ('dwarka', 3, 6037), ('dwarka', 4, 7178),
  ('dwarka', 5, 8319), ('dwarka', 6, 9460), ('dwarka', 7, 10601), ('dwarka', 8, 11743),
  ('dwarka', 9, 12884), ('dwarka', 10, 14025), ('dwarka', 11, 15166), ('dwarka', 12, 16307);

-- 2. New columns on enquiries — adults/children/infants breakdown, new discount-category system.
--    repeat_discount_pct is left untouched; discount_pct/discount_category are additive.
ALTER TABLE enquiries ADD COLUMN adults            INTEGER DEFAULT 0;
ALTER TABLE enquiries ADD COLUMN children          INTEGER DEFAULT 0;
ALTER TABLE enquiries ADD COLUMN infants           INTEGER DEFAULT 0;
ALTER TABLE enquiries ADD COLUMN discount_category TEXT;
ALTER TABLE enquiries ADD COLUMN discount_pct      REAL DEFAULT 0;
