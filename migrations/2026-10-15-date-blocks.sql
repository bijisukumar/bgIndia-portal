-- Dates the OWNER closes by hand: family use, maintenance, a festival, a night
-- the villa simply cannot host.
--
-- Until now the only way to close nights was to do it on a platform (Airbnb's
-- calendar) and let the portal read it back, or to enter a fake booking, which
-- makes a guest, a manager commission and a revenue line. A block here is
-- neither: no stay, no guest, no commission, no revenue. It is a plain range of
-- nights, and every part of the system that decides whether a night is free
-- reads it:
--   * the Channel calendar shows it (and flags a booking that lands on it);
--   * every platform's calendar link carries it, Airbnb's included, because no
--     platform made it;
--   * the enquiry screen's availability check and its "other dates" refuse it;
--   * the upcoming-gaps card does not call it a gap.
--
-- start_date is the first night closed; end_date is the MORNING the villa can
-- take guests again (exclusive), the same way a booking's checkout_date works,
-- so a block 14 Oct -> 17 Oct closes the nights of the 14th, 15th and 16th and
-- a guest can check in on the 17th. removed_at is a soft delete: a removed
-- block drops out of every list and feed at once and stays on record.
--
-- reason is one of owner_use | maintenance | festival | other; note is free
-- text for the owner only: neither is ever sent to a platform (the platform
-- sees "Unavailable (Owner block)").
--
-- Applied to bgindia-db, which serves every host (dwarka, demo, ...); every
-- row is scoped by villa_id.

CREATE TABLE IF NOT EXISTS stayvibe_date_blocks (
  block_id    TEXT PRIMARY KEY,
  villa_id    TEXT NOT NULL DEFAULT 'dwarka',
  start_date  TEXT NOT NULL,                 -- first night closed, 'YYYY-MM-DD'
  end_date    TEXT NOT NULL,                 -- the morning it opens again (exclusive)
  reason      TEXT NOT NULL DEFAULT 'other', -- owner_use | maintenance | festival | other
  note        TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT,
  updated_at  TEXT,
  removed_at  TEXT,
  removed_by  TEXT
);
CREATE INDEX IF NOT EXISTS stayvibe_idx_date_blocks ON stayvibe_date_blocks(villa_id, removed_at, start_date, end_date);
