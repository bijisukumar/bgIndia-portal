-- ============================================================================
-- LEDGER STEP A — CREATE TABLES + SEED CHANNELS  (already executed; committed
-- for the record). Idempotent — safe to re-run any time.
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/ledger-step-a-create-tables.sql --remote
--
-- Spec: docs/DB-Ledger-Refactor-Spec.md (v2). Includes the four approved
-- refinements — notably payout_map's surrogate map_id PK + nullable line_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS channels (
  channel_id  TEXT PRIMARY KEY,     -- 'airbnb' | 'direct' | 'booking.com' ...
  name        TEXT NOT NULL,
  is_direct   INTEGER DEFAULT 0,
  default_commission_pct REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS booking_line_items (
  line_id      TEXT PRIMARY KEY,
  stay_id      TEXT NOT NULL,
  villa_id     TEXT,
  item_type    TEXT NOT NULL,       -- controlled vocab: room_fee | cleaning_fee |
                                    -- extra_charge | discount | channel_commission |
                                    -- guest_service_fee | guest_tax
  direction    TEXT NOT NULL,       -- 'inflow' | 'outflow' | 'passthrough'
  gross_amount REAL NOT NULL DEFAULT 0,
  tax_amount   REAL NOT NULL DEFAULT 0,   -- GST on this line; 0 on backfill,
                                          -- populated when Booking.com lands
  note         TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bli_stay  ON booking_line_items(stay_id);
CREATE INDEX IF NOT EXISTS idx_bli_villa ON booking_line_items(villa_id);
CREATE INDEX IF NOT EXISTS idx_bli_type  ON booking_line_items(item_type);

CREATE TABLE IF NOT EXISTS payouts (
  payout_id       TEXT PRIMARY KEY,
  channel_id      TEXT,
  payout_ref      TEXT,             -- bank memo / statement id
  payout_date     TEXT,
  amount_received REAL DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Surrogate map_id PK (not composite payout_id+stay_id) so a single stay can
-- receive multiple settlement events — modifications, partial refunds,
-- adjustment payouts — under the same or different payout batches.
-- line_id is nullable: allocation can be stay-level or line-level.
CREATE TABLE IF NOT EXISTS payout_map (
  map_id           TEXT PRIMARY KEY,
  payout_id        TEXT NOT NULL,
  stay_id          TEXT NOT NULL,
  line_id          TEXT,
  allocated_amount REAL DEFAULT 0,
  created_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pmap_payout ON payout_map(payout_id);
CREATE INDEX IF NOT EXISTS idx_pmap_stay   ON payout_map(stay_id);

INSERT OR IGNORE INTO channels (channel_id, name, is_direct, default_commission_pct) VALUES
  ('direct','Direct',1,0),
  ('airbnb','Airbnb',0,3),
  ('booking.com','Booking.com',0,15),
  ('expedia','Expedia',0,15),
  ('vrbo','VRBO',0,5),
  ('agoda','Agoda',0,15),
  ('makemytrip','MakeMyTrip',0,15);
