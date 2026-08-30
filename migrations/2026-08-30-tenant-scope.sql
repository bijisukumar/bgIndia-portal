-- Tenant scope: give every stayvibe data table its own villa_id.
--
-- These 11 tables were reachable only through a foreign key to something
-- villa-scoped (stay_id, enquiry_id, campaign_id). That was defensible until
-- you notice the central guard only validates villa ids the CALLER SENDS, so
-- any query that never mentions a villa slips past it entirely - including a
-- bulk UPDATE that marks commissions paid across every tenant at once.
--
-- Backfill is unambiguous today because dwarka is the only tenant with data.
-- That stops being true the moment a second host has traffic, which is why
-- this runs now.
--
-- stayvibe_channels is deliberately excluded: Airbnb/Booking.com/Agoda and
-- their default commission rates are global reference data, not tenant data.

ALTER TABLE stayvibe_guests              ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_manager_commissions ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_incidentals         ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_communication_log   ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_bookings            ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_guest_documents     ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_guest_requests      ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_cars                ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_payouts             ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_payout_map          ADD COLUMN villa_id TEXT;
ALTER TABLE stayvibe_campaign_analytics  ADD COLUMN villa_id TEXT;

-- Derive from the parent wherever one still exists.

UPDATE stayvibe_manager_commissions SET villa_id =
  (SELECT s.villa_id FROM stayvibe_stays s WHERE s.stay_id = stayvibe_manager_commissions.stay_id)
  WHERE villa_id IS NULL;

UPDATE stayvibe_incidentals SET villa_id =
  (SELECT s.villa_id FROM stayvibe_stays s WHERE s.stay_id = stayvibe_incidentals.stay_id)
  WHERE villa_id IS NULL;

UPDATE stayvibe_guest_documents SET villa_id =
  (SELECT s.villa_id FROM stayvibe_stays s WHERE s.stay_id = stayvibe_guest_documents.stay_id)
  WHERE villa_id IS NULL;

UPDATE stayvibe_guest_requests SET villa_id =
  (SELECT s.villa_id FROM stayvibe_stays s WHERE s.stay_id = stayvibe_guest_requests.stay_id)
  WHERE villa_id IS NULL;

UPDATE stayvibe_cars SET villa_id =
  (SELECT s.villa_id FROM stayvibe_stays s WHERE s.stay_id = stayvibe_cars.stay_id)
  WHERE villa_id IS NULL;

UPDATE stayvibe_payout_map SET villa_id =
  (SELECT s.villa_id FROM stayvibe_stays s WHERE s.stay_id = stayvibe_payout_map.stay_id)
  WHERE villa_id IS NULL;

UPDATE stayvibe_bookings SET villa_id =
  (SELECT s.villa_id FROM stayvibe_stays s WHERE s.stay_id = stayvibe_bookings.stay_id)
  WHERE villa_id IS NULL;

UPDATE stayvibe_communication_log SET villa_id =
  (SELECT e.villa_id FROM stayvibe_enquiries e WHERE e.enquiry_id = stayvibe_communication_log.enquiry_id)
  WHERE villa_id IS NULL;

UPDATE stayvibe_campaign_analytics SET villa_id =
  (SELECT m.villa_id FROM stayvibe_marketing_campaigns m WHERE m.id = stayvibe_campaign_analytics.campaign_id)
  WHERE villa_id IS NULL;

-- Guests link through stays.guest_id, but only 15 of 310 do; the rest arrived
-- via enquiries or the check-in form and never got a stay reference.

UPDATE stayvibe_guests SET villa_id =
  (SELECT s.villa_id FROM stayvibe_stays s WHERE s.guest_id = stayvibe_guests.guest_id LIMIT 1)
  WHERE villa_id IS NULL;

-- Anything still unmatched predates the second tenant, so it is dwarka's by
-- construction: 29 commissions whose stay was deleted, and the 295 guests with
-- no stay link. This claim is only true while dwarka is the sole tenant with
-- data, which is verified before this migration runs.

UPDATE stayvibe_guests              SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_manager_commissions SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_incidentals         SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_communication_log   SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_bookings            SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_guest_documents     SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_guest_requests      SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_cars                SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_payouts             SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_payout_map          SET villa_id = 'dwarka' WHERE villa_id IS NULL;
UPDATE stayvibe_campaign_analytics  SET villa_id = 'dwarka' WHERE villa_id IS NULL;

-- Every isolation filter is WHERE villa_id IN (...), so these carry real load.

CREATE INDEX IF NOT EXISTS idx_guests_villa       ON stayvibe_guests(villa_id);
CREATE INDEX IF NOT EXISTS idx_comm_villa         ON stayvibe_manager_commissions(villa_id);
CREATE INDEX IF NOT EXISTS idx_incidentals_villa  ON stayvibe_incidentals(villa_id);
CREATE INDEX IF NOT EXISTS idx_commlog_villa      ON stayvibe_communication_log(villa_id);
CREATE INDEX IF NOT EXISTS idx_bookings_villa     ON stayvibe_bookings(villa_id);
CREATE INDEX IF NOT EXISTS idx_guestdocs_villa    ON stayvibe_guest_documents(villa_id);
CREATE INDEX IF NOT EXISTS idx_guestreq_villa     ON stayvibe_guest_requests(villa_id);

-- Guest identity is per tenant: the same person staying with two hosts gets a
-- row each, so neither host's counters or contact details leak into the other.
CREATE INDEX IF NOT EXISTS idx_guests_villa_phone ON stayvibe_guests(villa_id, phone);
CREATE INDEX IF NOT EXISTS idx_guests_villa_email ON stayvibe_guests(villa_id, email);
