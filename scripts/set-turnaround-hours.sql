-- Dwarka's turnaround 6 -> 4 hours (Biji, 2026-10-28, about a late check-out agreed for 11:30: "up to noon, it's ok ... flag it in the
-- app, but not block that night"). A noon check-out leaves exactly 4 hours before the standard 4 PM check-in, so with 4 hours:
--   * an agreed late check-out up to 12:00 holds nothing (the calendar flags it with a clock, the night stays open to book);
--   * after 12:00 the night is held as before;
--   * an agreed early check-in from 3 PM holds nothing (before 3 PM it holds the night before);
--   * Raman's "tight turnaround" warning needs less than 4 hours between a departure and the next arrival (it was 6, so every
--     same-day changeover at the standard times, 5 hours, was shown as tight).
-- Two values carry the number: the live setting (the Worker reads it first) and the stored config snapshot the screens read.
-- Both only change if they still say 6, so running this twice does nothing the second time.
-- Run:  npx wrangler d1 execute bgindia-db --remote --file=scripts/set-turnaround-hours.sql
-- Undo: swap '4' for '6' and 4 for 6 in the two UPDATEs below (and the '= 6' / "= '6'" tests for '= 4' / "= '4'").
UPDATE stayvibe_villa_settings
   SET value = '4', updated_by = 'owner', updated_at = datetime('now')
 WHERE villa_id = 'dwarka' AND key = 'turnaround_hours' AND value = '6';
UPDATE platform_tenant_config
   SET config_json = json_set(config_json, '$.turnaround.turnaroundHours', 4), updated_at = datetime('now')
 WHERE tenant_id = 'dwarka' AND json_extract(config_json, '$.turnaround.turnaroundHours') = 6;
INSERT OR IGNORE INTO infra_processing_log (log_id, event_type, stay_id, note, created_at) VALUES
  ('LOG-turnaround-4h-20261028', 'settings', NULL, 'Turnaround hours 6 -> 4 at the owner''s request (a late check-out up to noon holds no night and is flagged instead): live setting and stored config.', datetime('now'));
