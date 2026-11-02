-- commission_pct described a rate that was never checked against the money.
--
-- The Airbnb poller sent a hardcoded 3 on every import. That was true while
-- the listing was on split fees - the guest paid ~12%, the host ~3% - and it
-- became wrong on 2026-10-10 when the listing moved to host-only fees: guest
-- service fee 0, host service fee 15.5%. The AMOUNT was parsed from the payout
-- email and was right the whole time, so the percentage was the only thing
-- lying. Nothing caught it because nothing recomputes from it today - but
-- anything that ever does would have understated Airbnb's cut fivefold.
--
-- Only rows where the two actually disagree are touched, so a correct row is
-- left alone rather than rewritten to the same value.
--
-- Two rows come out looking odd and are meant to: DWK-2026-7250 at 31.9%
-- (gross 1,000 against commission 319.50) and DWK-2026-22309 at 1.5% (Gulshan,
-- the booking from the duplicate-merge incident). Those are amount problems,
-- not rate problems; recording 3% for them would only hide that.

UPDATE stayvibe_stays
   SET commission_pct = ROUND(commission_amt * 100.0 / gross, 1)
 WHERE gross > 0
   AND commission_amt > 0
   AND ABS(commission_pct - ROUND(commission_amt * 100.0 / gross, 1)) > 0.1;
