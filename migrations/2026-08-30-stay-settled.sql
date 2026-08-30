-- Raman settles a stay after check-out: records incidentals, then marks it
-- ready for the owner to close. Deliberately NOT a status change — the review
-- chase list filters on status = 'checked_out', so closing it here would
-- silently delete the owner's follow-up.
ALTER TABLE stayvibe_stay_ext ADD COLUMN settled_at   TEXT;
ALTER TABLE stayvibe_stay_ext ADD COLUMN settled_by   TEXT;
ALTER TABLE stayvibe_stay_ext ADD COLUMN settle_note  TEXT;
