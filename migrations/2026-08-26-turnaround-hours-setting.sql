-- Configurable cleaning-turnaround buffer between one guest's departure and
-- the next guest's arrival, per villa. Was previously a hardcoded 4 hours in
-- hosts/dwarka/config.js (turnaround.turnaroundHours), used only by the
-- checkAvailability double-booking check. The new checkTurnaroundGap action
-- reads this D1 value (falling back to 6 if unset) so it's editable without
-- a code deploy.
INSERT INTO stayvibe_villa_settings (villa_id, key, value, updated_by)
VALUES ('dwarka', 'turnaround_hours', '6', 'owner')
ON CONFLICT(villa_id, key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now');
