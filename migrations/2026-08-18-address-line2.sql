-- Home address gains a second street line and an explicit country, so the
-- form works for guests living outside India (NRI/OCI holders in particular).
-- city/state/pincode already exist and are reused as-is.
ALTER TABLE stayvibe_stays ADD COLUMN home_address_line2 TEXT;

-- NOTE: this FAILS on demovilla-db with
--   too many columns on sqlite_altertab_stayvibe_stays: SQLITE_ERROR
-- because that database never received the column split that brought
-- bgindia-db's stayvibe_stays down from the 100-column ALTER ceiling.
-- demovilla's stays table must be rebuilt (same split: KYC + prefs moved to
-- side tables) before it can take this column or the current worker bundle.
