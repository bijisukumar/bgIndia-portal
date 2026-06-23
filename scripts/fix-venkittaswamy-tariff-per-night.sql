-- ── FIX: missing tariff_per_night on Venkittaswamy's stay ───────────────
-- The earlier consolidation script (consolidate-venkittaswamy-parvathy-
-- booking.sql) moved gross/net (12000/12000) onto this record, but the
-- Complete Booking screen's financial form reads from tariff_per_night
-- (per-night rate), not gross/net directly -- so it still showed 0.
--
-- Sets tariff_per_night = gross / nights, so the per-night rate is correct
-- regardless of how many nights this particular stay covers.

UPDATE stays
SET tariff_per_night = ROUND(gross / NULLIF(nights, 0), 2),
    updated_by = 'owner', updated_at = datetime('now')
WHERE stay_id = 'DWK-2026-44553';

-- Verify after running:
--   SELECT stay_id, nights, gross, net, tariff_per_night FROM stays WHERE stay_id = 'DWK-2026-44553';
--   -- Expect: nights=1, gross=12000, net=12000, tariff_per_night=12000
