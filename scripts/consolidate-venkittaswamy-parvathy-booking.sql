-- ── ONE-TIME CONSOLIDATION: Venkittaswamy / Parvathy duplicate booking ──
-- Two stays rows exist for the same villa dates (2026-07-01 → 2026-07-02):
--   DWK-2026-44553  Venkittaswamy   — actual guest, has Drive check-in folder,
--                   already linked booked_by -> Parvathy (GST-BACKFILL-38),
--                   but gross/net = 0 and status stuck at pending_review
--   DWK-2026-98708  Parvathy Ramasamy — has the real money (gross/net=12000),
--                   status=confirmed, created via the Enquiry/CRM flow
--
-- DECISION (confirmed with owner): Venkittaswamy's record survives — he's
-- the one who actually checks in and has the Drive folder. The booking
-- value moves onto his record. Parvathy's record is cancelled (not
-- deleted) since she's already correctly recorded as the booking contact
-- via booked_by_name/booked_by_guest_id on Venkittaswamy's record — that
-- link is what preserves her association with this booking going forward,
-- not having her own separate stays row.
--
-- Owner explicitly decided this booking's revenue should NOT count toward
-- Parvathy's own guests.total_revenue/total_stays (those track guests who
-- personally stayed, not who paid) — so no guests table update is needed;
-- her counters were never incremented by this stay in the first place
-- (the backfill only counts stays where she is guest_name).
--
-- No raman_commissions row exists yet for either stay (confirmed before
-- writing this script) — nothing to clean up there.
--
-- Run each statement in order. No BEGIN/COMMIT — D1's console rejects it.

-- 1) Move the real financials onto Venkittaswamy's record and advance it
--    out of pending_review so it stops nagging on the dashboard.
UPDATE stays
SET gross = 12000, net = 12000, status = 'confirmed', updated_by = 'owner', updated_at = datetime('now')
WHERE stay_id = 'DWK-2026-44553';

-- 2) Cancel Parvathy's duplicate record and zero its financials so it can
--    never double-count revenue even if some report forgets to filter
--    out cancelled stays.
UPDATE stays
SET status = 'cancelled', gross = 0, net = 0, updated_by = 'owner', updated_at = datetime('now')
WHERE stay_id = 'DWK-2026-98708';

-- 3) Repoint the CRM bookings link row at the surviving stay, so the
--    Enquiry Conversion Dashboard's booking-value figures still trace
--    back to a real, active stay record.
UPDATE bookings
SET stay_id = 'DWK-2026-44553'
WHERE stay_id = 'DWK-2026-98708';

-- enquiries row is left untouched on purpose — status=confirmed,
-- booking_confirmed=1, booking_value=12000 stays exactly as-is. This is
-- the correct, permanent record that Parvathy made and paid for this
-- booking, which is exactly the credit she keeps per the owner's decision.

-- Verify after running:
--   SELECT stay_id, guest_name, gross, net, status, booked_by_name FROM stays
--     WHERE stay_id IN ('DWK-2026-44553','DWK-2026-98708');
--   -- Expect: Venkittaswamy gross=12000 net=12000 status=confirmed booked_by_name=Parvathy Ramasamy
--   --         Parvathy     gross=0     net=0     status=cancelled
--   SELECT booking_id, stay_id FROM bookings WHERE booking_id = 'BKG-1781979649923-ko7l';
--   -- Expect: stay_id now DWK-2026-44553
