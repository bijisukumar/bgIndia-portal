-- Dates for the seasons Biji named (2026-10-28: Christmas / New Year, Guruvayur Ekadasi, Onam), SWITCHED OFF at +0% so no quote changes until he
-- sets a percentage or prices and switches each on from the Rates & seasons page. Safe to run twice (fixed ids, INSERT OR IGNORE).
-- Run:  npx wrangler d1 execute bgindia-db --remote --file=scripts/seed-rate-seasons-preset.sql
-- Undo: DELETE FROM stayvibe_rate_seasons WHERE season_id IN ('SEAS-seed-xmas','SEAS-seed-ekadasi-2026','SEAS-seed-onam-2027');
-- (Anyone can add the same three from the page: "+ Christmas / New Year" and "+ Add a season".)
INSERT OR IGNORE INTO stayvibe_rate_seasons (season_id, villa_id, name, start_date, end_date, yearly, mode, uplift_pct, card_json, min_nights, active, notes, created_by, updated_by) VALUES
  ('SEAS-seed-xmas', 'dwarka', 'Christmas / New Year', '2026-12-20', '2027-01-05', 1, 'percent', 0, NULL, NULL, 0,
   'Repeats every year: 20 Dec to 5 Jan (nights). Dates preset; set the price and switch on.', 'preset', 'preset'),
  ('SEAS-seed-ekadasi-2026', 'dwarka', 'Guruvayur Ekadasi 2026', '2026-11-19', '2026-11-22', 0, 'percent', 0, NULL, NULL, 0,
   'Guruvayur Ekadasi is Saturday 21 Nov 2026 (Drik Panchang and the temple festival calendar). Preset window: the nights of 19 to 22 Nov. Adjust the dates, set the price and switch on. The date moves every year, so add next year as a new season.', 'preset', 'preset'),
  ('SEAS-seed-onam-2027', 'dwarka', 'Onam 2027', '2027-09-10', '2027-09-14', 0, 'percent', 0, NULL, NULL, 0,
   'Thiruvonam 2027 is 12 Sep (Drik Panchang) or 13 Sep (AstroSage): confirm with the Kerala calendar, then adjust. Preset window: the nights of 10 to 14 Sep. Set the price and switch on.', 'preset', 'preset');
INSERT OR IGNORE INTO infra_processing_log (log_id, event_type, stay_id, note, created_at) VALUES
  ('LOG-seed-seasons-20261028', 'rates', NULL, 'Three seasons preset (switched off, +0%) at the owner''s request: Christmas / New Year (20 Dec to 5 Jan, yearly), Guruvayur Ekadasi 2026 (19 to 22 Nov), Onam 2027 (10 to 14 Sep). No price is set until the owner sets one and switches each on.', datetime('now'));
