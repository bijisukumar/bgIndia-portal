-- Payments received against a booking: the day each one came in, so a guest who pays AFTER booking, or in parts, is on record
-- ("Payments" on Complete booking, 2026-11-17).
--
-- One row per payment, so this is a table of its own: stayvibe_stays is at 81 of D1's 100 columns (docs/SESSION-HANDOFF.md,
-- "Stay data is no longer one table"), and a payment is a ROW, never a column. A booking paid in one go has one row, a booking paid
-- in parts has several; nothing here changes stayvibe_stays.
--
-- paid_date is the day the money was received ('YYYY-MM-DD', the property's day). amount is rupees. payment_mode is one of the host's
-- own list (payments.modes in hosts/<id>/config.js; UPI, Bank transfer, Cash, Card, Other when it gives none). note is a reference
-- number or a word like "advance". recorded_at is the server's UTC stamp. removed_at is a soft delete: a removed payment drops out of
-- every total at once and stays on record (who removed it, and when).
--
-- Applied to bgindia-db, which serves every host (dwarka, demo, ...); every row is scoped by villa_id.
--
--   Apply (once):  npx wrangler d1 execute bgindia-db --remote --file migrations/2026-11-17-stay-payments.sql
--   Undo:          npx wrangler d1 execute bgindia-db --remote --command "DROP TABLE IF EXISTS stayvibe_stay_payments"
--                  (this erases every payment recorded since)
--
-- Safe to run twice. The Worker copes without it: payments then read as none, and cannot be added until this has run.

CREATE TABLE IF NOT EXISTS stayvibe_stay_payments (
  payment_id   TEXT PRIMARY KEY,
  stay_id      TEXT NOT NULL,
  villa_id     TEXT NOT NULL,
  amount       REAL NOT NULL,
  paid_date    TEXT NOT NULL,
  payment_mode TEXT,
  note         TEXT,
  recorded_by  TEXT,
  recorded_at  TEXT DEFAULT (datetime('now')),
  removed_at   TEXT,
  removed_by   TEXT
);

CREATE INDEX IF NOT EXISTS idx_stay_payments_stay  ON stayvibe_stay_payments(stay_id);
CREATE INDEX IF NOT EXISTS idx_stay_payments_villa ON stayvibe_stay_payments(villa_id, paid_date);
