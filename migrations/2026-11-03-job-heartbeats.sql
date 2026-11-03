-- "Last ran": the Google scripts that work from the owner's mailbox report in after every run.
--
-- The Airbnb email reader (apps-script/poll-reservations) runs every 5 minutes on a trigger in the owner's Google account. When it
-- stops (a trigger deleted, an authorisation that expired, a Google outage, a run that is killed for taking too long) nothing says so:
-- a new booking, a cancellation or a change request just never arrives. Each run now ends by telling the Worker (recordJobRun) that it
-- ran, how long it took and how it went; the calendar warning on Home and on the Channel calendar turns red, and the owner is emailed,
-- when a script has been silent for more than four of its own runs (src/utils/calendarHealth.js, job_silent / job_failing).
--
-- One row per script per villa, overwritten by each run: this is the LATEST report, not a history (runs counts the reports received).
-- The same table also holds, one row per calendar feed (job 'feed:<feed_id>'), the last read of that calendar that WORKED: a failed try
-- overwrites stayvibe_ical_feeds.last_synced_at, and an empty calendar has no booking to date a good read by, so without this a single
-- slow answer from a platform whose calendar happens to be empty could not be told from a calendar that has gone quiet.
-- Until this table exists the Worker answers recordJobRun with recorded:false and the warning has no script to watch, so the order of
-- deploy and migration does not matter.
--
-- Applied to bgindia-db, which serves every host (dwarka, demo, ...); every row is scoped by villa_id.

CREATE TABLE IF NOT EXISTS infra_job_heartbeats (
  villa_id       TEXT NOT NULL,
  job            TEXT NOT NULL,             -- the script's own name for itself, e.g. poll-reservations
  label          TEXT,                      -- how it reads on screen and in emails
  every_minutes  INTEGER,                   -- how often its trigger fires
  last_run_at    TEXT,                      -- UTC, as the database writes it
  last_ok_at     TEXT,                      -- the last run that ended well
  last_status    TEXT,                      -- ok | error
  last_ms        INTEGER,                   -- how long the last run took
  last_summary   TEXT,                      -- what it did, a line (counts and step timings), or why it failed
  runs           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (villa_id, job)
);
