-- Booking changes waiting for the owner's decision (2026-10-27).
--
-- A guest who asks to change how many people are coming is parked here until the owner approves or declines it:
--   kind 'airbnb_email'  - Airbnb's "<guest> wants to change their reservation" email, read by the Gmail poller
--                          (scripts/PollNewReservationAndProcess.gs -> recordChangeRequest)
--   kind 'checkin_form'  - the guest's own check-in form gave a different guest count from the booking
-- While one is pending the stay cannot be marked ready for check-in (setReadyForCheckIn / approvePendingBooking /
-- updateStayStatus answer 409), and the owner's home, Complete booking and the manager's lists flag it.
--
-- Additive and safe to run twice. The Worker wraps every read of this table, so a database without it still serves every screen.
-- Run: npx wrangler d1 execute bgindia-db --remote --file=scripts/migrate-change-requests.sql
-- Undo: DROP TABLE stayvibe_change_requests;   (nothing else refers to it)

CREATE TABLE IF NOT EXISTS stayvibe_change_requests (
  request_id          TEXT PRIMARY KEY,
  villa_id            TEXT NOT NULL,
  stay_id             TEXT,                        -- the booking it was matched to; NULL = could not be matched
  kind                TEXT NOT NULL,               -- airbnb_email | checkin_form
  guest_name          TEXT,                        -- as the email / form names them
  confirmation_code   TEXT,                        -- Airbnb code, when the email carried one
  original_guests     INTEGER,                     -- booked
  requested_guests    INTEGER,                     -- asked for
  requested_adults    INTEGER,                     -- the split, when the source gave one (the check-in form does)
  requested_children  INTEGER,
  detail              TEXT,                        -- the source's own words, so nothing is lost when parsing misses
  email_id            TEXT,                        -- Gmail message id: the same email is never recorded twice
  status              TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | declined
  decided_by          TEXT,
  decided_at          TEXT,
  decision_note       TEXT,
  applied_adults      INTEGER,                     -- what the stay was set to on approval
  applied_children    INTEGER,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_change_requests_email ON stayvibe_change_requests(email_id) WHERE email_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_change_requests_stay  ON stayvibe_change_requests(stay_id, status);
CREATE INDEX IF NOT EXISTS idx_change_requests_villa ON stayvibe_change_requests(villa_id, status);
