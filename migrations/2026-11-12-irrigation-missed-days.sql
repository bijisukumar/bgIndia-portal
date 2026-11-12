-- A day with no irrigation entry at all is missing data.
--
-- The screens could only ever say "zone 5 was watered 5 days ago" - current
-- state, inferred from the last entry. Nobody could see WHICH DAYS had no
-- entry, so a gap scrolled off the top of the history and was gone. In the 45
-- days to 2026-11-12 there were 28 such days, including an eight-day stretch
-- nobody was in a position to notice.
--
-- This records the owner saying "seen, that is fine" against one of those
-- days, so an explained gap stops being raised while an unexplained one keeps
-- showing. Rows exist only for days that have been acknowledged; a missing day
-- with no row here is simply still outstanding.
--
-- Columns: missed_date is the day with no entry (YYYY-MM-DD); reason is
-- optional free text such as rain, pump down, nobody on site.

CREATE TABLE IF NOT EXISTS estate360_irrigation_missed_days (
  estate       TEXT NOT NULL,
  missed_date  TEXT NOT NULL,
  reason       TEXT,
  approved_by  TEXT NOT NULL,
  approved_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (estate, missed_date)
);

CREATE INDEX IF NOT EXISTS idx_irr_missed_estate_date
  ON estate360_irrigation_missed_days(estate, missed_date);
