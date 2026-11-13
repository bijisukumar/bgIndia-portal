-- Why a day had no irrigation entry, as a code rather than as whatever words
-- came to mind.
--
-- The reason column that shipped this morning is free text, and free text
-- cannot be counted: "power cut", "Power Cut", "current gone" and "no EB" are
-- one cause typed four ways. Twenty-eight explained gaps would still not
-- answer the only question worth asking of them - what keeps stopping the
-- water - so the explaining would be effort spent for nothing.
--
-- reason_code holds one of a fixed set (power_cut, pump_fault, no_water,
-- not_needed, nobody_on_site, other), checked in the Worker against
-- IRRIGATION_MISS_REASONS so the screen and the column cannot drift apart.
-- reason stays, and keeps its old job: the detail a code cannot carry. It is
-- required only for 'other', where it is the whole of the answer.
--
-- Rows written before this are left with reason_code NULL. They are the
-- owner's own OKs, which never needed a code, so nothing is backfilled and
-- nothing is guessed from their prose.

ALTER TABLE estate360_irrigation_missed_days ADD COLUMN reason_code TEXT;
