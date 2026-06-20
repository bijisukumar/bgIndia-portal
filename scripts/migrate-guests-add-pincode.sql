-- ════════════════════════════════════════════════════════════
-- Migration: add pincode to guests table.
--
-- stays already has a pincode column (added by
-- migrate-location-columns.sql), written by the live check-in form.
-- guests never got the matching column, so the address backfill script
-- (fill-guest-addresses.sql) had to fold pincode into the combined
-- 'address' text field instead of storing it separately.
--
-- This adds the missing column. Run once, then re-run
-- fill-guest-addresses-v2.sql (or the pincode-only patch below) to
-- populate it for the 83 guests we have pincode data for.
-- ════════════════════════════════════════════════════════════

ALTER TABLE guests ADD COLUMN pincode TEXT;
