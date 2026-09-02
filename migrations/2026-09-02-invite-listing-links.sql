-- Pilot signup from the pricing page.
--
-- The invite form on www asks for one listing link, because at that stage we
-- only want to see the property exists and looks the way they describe it.
-- Signing up for the pilot is a different moment: the same villa is usually
-- live on several channels at once - Airbnb, Booking.com, Agoda, MakeMyTrip,
-- VRBO and often the host's own site - and setting up a calendar sync means
-- having every one of those addresses before the onboarding call, not
-- collecting them one at a time over WhatsApp afterwards.
--
-- Stored as newline-separated URLs in one column rather than a child table.
-- Six links, read by a human, never queried by URL: a table would be correct
-- and useless. airbnb_link stays as it is so nothing already captured moves.
ALTER TABLE platform_invite_requests ADD COLUMN listing_links TEXT;

-- Which form this row came from. Everything before this migration came from
-- the invite form on www, hence the default: back-filling 'invite' would say
-- the same thing with more moving parts.
--   invite - the by-invitation form at www.stayvibe360.com/#invite
--   pilot  - the sign-up form at www.stayvibe360.com/pricing, filled in after
--            a call, by someone who has already been shown the product
ALTER TABLE platform_invite_requests ADD COLUMN intent TEXT DEFAULT 'invite';
