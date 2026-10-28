-- Busy-season rates (2026-10-28).
--
-- The villa's rate card (stayvibe_villa_rate_cards) prices a night by party size, the same all year. A season changes the price for a
-- range of dates: a percentage on the card (mode 'percent', uplift_pct; negative for a low season) or a card of its own (mode 'card',
-- card_json = [{"guests":10,"tariff":20000}, ...]). start_date and end_date are the first and last NIGHT, inclusive; with yearly = 1 the
-- year is ignored and the range repeats every year (a range that ends earlier in the year than it starts wraps over New Year).
-- The pricing rules are src/utils/seasonRates.js; the Rates page (owner) edits these rows; New enquiry, Enquiry detail and the agent
-- quote link price each night by the season it falls in.
--
-- Additive and safe to run twice. The Worker wraps every read of this table, so a database without it prices from the card alone.
-- Run: npx wrangler d1 execute bgindia-db --remote --file=scripts/migrate-rate-seasons.sql
-- Undo: DROP TABLE stayvibe_rate_seasons;   (nothing else refers to it)

CREATE TABLE IF NOT EXISTS stayvibe_rate_seasons (
  season_id   TEXT PRIMARY KEY,
  villa_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL,                       -- first night, YYYY-MM-DD
  end_date    TEXT NOT NULL,                       -- last night, YYYY-MM-DD, inclusive
  yearly      INTEGER NOT NULL DEFAULT 0,          -- 1 = repeats every year (the year in the dates is ignored)
  mode        TEXT NOT NULL DEFAULT 'percent',     -- percent | card
  uplift_pct  REAL,                                -- mode percent: +30 = 30% more, -20 = a low season
  card_json   TEXT,                                -- mode card: the season's own prices
  min_nights  INTEGER,                             -- minimum stay in the season (a note on the quote, not a block)
  active      INTEGER NOT NULL DEFAULT 1,
  notes       TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT,
  updated_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_rate_seasons_villa ON stayvibe_rate_seasons(villa_id, active);
