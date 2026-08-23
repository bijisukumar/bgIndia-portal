-- No-Show: reuses status='cancelled' (already correctly excluded from every
-- active-stay/calendar/double-booking query) with a distinct flag, rather
-- than threading a brand-new terminal status through dozens of existing
-- "status NOT IN ('cancelled',...)" queries across the codebase.
ALTER TABLE stayvibe_stays ADD COLUMN no_show INTEGER DEFAULT 0;

-- Refund tracking — rare enough (per the owner) that it doesn't need its
-- own top-level columns on stayvibe_stays (already at 80/100 columns after
-- two prior side-table splits for exactly this reason). stayvibe_stay_ext
-- is the existing "occasionally-used financial extra" side table.
ALTER TABLE stayvibe_stay_ext ADD COLUMN refund_amount REAL DEFAULT 0;
ALTER TABLE stayvibe_stay_ext ADD COLUMN refund_reason TEXT;
ALTER TABLE stayvibe_stay_ext ADD COLUMN refunded_at TEXT;
ALTER TABLE stayvibe_stay_ext ADD COLUMN refunded_by TEXT;
