-- A log row that records a day when nothing was watered.
--
-- The zone health screen answers one question: when did this zone last get
-- water. It answers it with MAX(logged_date) for the zone, which trusts every
-- row in the table to mean "water ran here".
--
-- Eight days do not mean that. Catching up on the backlog, the estate manager
-- ticked all nine zones and wrote the reason in the note - "Tractor work",
-- "Maintaince work" - to say the day was accounted for, not that nine zones
-- had been watered. On 15 Nov 2026 that made seven of the nine zones read
-- "3 days since water" when the truth was seven days, and would have delayed
-- the dry-zone warning from 18 Nov to 22 Nov. Late, and in the direction
-- where a zone goes dry quietly.
--
-- Duration cannot be used to tell these apart: he often leaves it blank on a
-- real watering (6 Nov zones 4 and 7, 5 Nov zone 9, 3 Nov zones 6 and 8 are
-- all 0 minutes and all genuine). Nor can the note be matched as prose. So
-- the reason becomes a column, holding a code from IRRIGATION_MISS_REASONS,
-- and zone health skips any row that has one. Rain is NOT one of these: rain
-- waters every zone, which is why a rain day is left alone.
--
-- The rows stay. The day genuinely has an entry, so it is not a missing day;
-- it simply was not water, and the history of what happened on the estate is
-- worth more than a tidy table.

ALTER TABLE estate360_irrigation_logs ADD COLUMN not_watered_code TEXT;

-- Tractor work is land cleaning - the owner's own words, 15 Nov 2026.
UPDATE estate360_irrigation_logs
   SET not_watered_code = 'land_cleaning'
 WHERE estate = 'pollachi'
   AND notes = 'Tractor work'
   AND duration_mins = 0;

-- "Maintaince work" is NOT stated to be land cleaning, so it is not filed as
-- it. 'other' carries the words he actually wrote, and one tap on the Missing
-- days tab can re-code it if it turns out to be the same thing.
UPDATE estate360_irrigation_logs
   SET not_watered_code = 'other'
 WHERE estate = 'pollachi'
   AND notes = 'Maintaince work'
   AND duration_mins = 0;
