-- ============================================================================
-- ROLLBACK — RELEASE 2.1 — TABLE NAMESPACE: stayvibe_
-- ============================================================================
-- Reverses scripts/migrate-v2.1-namespace-stayvibe.sql exactly: renames
-- tables back to their pre-2.1 names and recreates indexes under their
-- original names.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/rollback-v2.1-namespace-stayvibe.sql --remote
-- ============================================================================

-- ── TABLE RENAMES (reverse) ─────────────────────────────────────
ALTER TABLE stayvibe_booking_line_items RENAME TO booking_line_items;
ALTER TABLE stayvibe_bookings           RENAME TO bookings;
ALTER TABLE stayvibe_campaign_analytics RENAME TO campaign_analytics;
ALTER TABLE stayvibe_cform_filings      RENAME TO cform_filings;
ALTER TABLE stayvibe_channels           RENAME TO channels;
ALTER TABLE stayvibe_checkin_links      RENAME TO checkin_links;
ALTER TABLE stayvibe_communication_log  RENAME TO communication_log;
ALTER TABLE stayvibe_duplicate_bookings RENAME TO duplicate_bookings;
ALTER TABLE stayvibe_enquiries          RENAME TO enquiries;
ALTER TABLE stayvibe_guest_documents    RENAME TO guest_documents;
ALTER TABLE stayvibe_guest_requests     RENAME TO guest_requests;
ALTER TABLE stayvibe_guests             RENAME TO guests;
ALTER TABLE stayvibe_inventory          RENAME TO inventory;
ALTER TABLE stayvibe_inventory_restock_log RENAME TO inventory_restock_log;
ALTER TABLE stayvibe_marketing_campaigns   RENAME TO marketing_campaigns;
ALTER TABLE stayvibe_payout_map         RENAME TO payout_map;
ALTER TABLE stayvibe_payouts            RENAME TO payouts;
ALTER TABLE stayvibe_manager_commissions RENAME TO raman_commissions;
ALTER TABLE stayvibe_cars               RENAME TO stay_cars;
ALTER TABLE stayvibe_incidentals        RENAME TO stay_incidentals;
ALTER TABLE stayvibe_stays              RENAME TO stays;
ALTER TABLE stayvibe_villa_expenses     RENAME TO villa_expenses;
ALTER TABLE stayvibe_villa_rate_cards   RENAME TO villa_rate_cards;
ALTER TABLE stayvibe_villa_settings     RENAME TO villa_settings;

-- ── INDEX RENAMES (reverse) ─────────────────────────────────────
DROP INDEX stayvibe_idx_bli_stay;
CREATE INDEX idx_bli_stay ON booking_line_items(stay_id);
DROP INDEX stayvibe_idx_bli_type;
CREATE INDEX idx_bli_type ON booking_line_items(item_type);
DROP INDEX stayvibe_idx_bli_villa;
CREATE INDEX idx_bli_villa ON booking_line_items(villa_id);

DROP INDEX stayvibe_idx_bookings_enquiry;
CREATE INDEX idx_bookings_enquiry ON bookings(enquiry_id);
DROP INDEX stayvibe_idx_bookings_guest;
CREATE INDEX idx_bookings_guest ON bookings(guest_id);
DROP INDEX stayvibe_idx_bookings_stay;
CREATE INDEX idx_bookings_stay ON bookings(stay_id);

DROP INDEX stayvibe_idx_analytics_campaign;
CREATE INDEX idx_analytics_campaign ON campaign_analytics(campaign_id, event_type);
DROP INDEX stayvibe_idx_analytics_ts;
CREATE INDEX idx_analytics_ts ON campaign_analytics(ts);

DROP INDEX stayvibe_idx_cform_filings_stay;
CREATE INDEX idx_cform_filings_stay ON cform_filings(stay_id);

DROP INDEX stayvibe_idx_checkin_links_villa;
CREATE INDEX idx_checkin_links_villa ON checkin_links(villa_id, is_active);

DROP INDEX stayvibe_idx_comm_log_enquiry;
CREATE INDEX idx_comm_log_enquiry ON communication_log(enquiry_id, occurred_at);

DROP INDEX stayvibe_idx_dup_detected;
CREATE INDEX idx_dup_detected ON duplicate_bookings(detected_at DESC);
DROP INDEX stayvibe_idx_dup_source;
CREATE INDEX idx_dup_source ON duplicate_bookings(new_source, detected_at DESC);
DROP INDEX stayvibe_idx_duplicate_bookings_resolved;
CREATE INDEX idx_duplicate_bookings_resolved ON duplicate_bookings(resolved);

DROP INDEX stayvibe_idx_enquiries_followup;
CREATE INDEX idx_enquiries_followup ON enquiries(follow_up_due);
DROP INDEX stayvibe_idx_enquiries_guest;
CREATE INDEX idx_enquiries_guest ON enquiries(guest_id);
DROP INDEX stayvibe_idx_enquiries_received;
CREATE INDEX idx_enquiries_received ON enquiries(date_received);
DROP INDEX stayvibe_idx_enquiries_source;
CREATE INDEX idx_enquiries_source ON enquiries(source);
DROP INDEX stayvibe_idx_enquiries_status;
CREATE INDEX idx_enquiries_status ON enquiries(status);

DROP INDEX stayvibe_idx_guests_email;
CREATE INDEX idx_guests_email ON guests(email);
DROP INDEX stayvibe_idx_guests_phone;
CREATE INDEX idx_guests_phone ON guests(phone);

DROP INDEX stayvibe_idx_restock_log_villa_item;
CREATE INDEX idx_restock_log_villa_item ON inventory_restock_log(villa_id, item_id);

DROP INDEX stayvibe_idx_campaigns_token;
CREATE INDEX idx_campaigns_token ON marketing_campaigns(unique_token);
DROP INDEX stayvibe_idx_campaigns_villa;
CREATE INDEX idx_campaigns_villa ON marketing_campaigns(villa_id, is_active);

DROP INDEX stayvibe_idx_pmap_payout;
CREATE INDEX idx_pmap_payout ON payout_map(payout_id);
DROP INDEX stayvibe_idx_pmap_stay;
CREATE INDEX idx_pmap_stay ON payout_map(stay_id);

DROP INDEX stayvibe_idx_manager_commissions_paid;
CREATE INDEX idx_raman_paid ON raman_commissions(is_paid, checkin_date);

DROP INDEX stayvibe_idx_incidentals_stay;
CREATE INDEX idx_incidentals_stay ON stay_incidentals(stay_id);

DROP INDEX stayvibe_idx_stays_audit;
CREATE INDEX idx_stays_audit ON stays(created_by, updated_by);
DROP INDEX stayvibe_idx_stays_checkin;
CREATE INDEX idx_stays_checkin ON stays(checkin_date);
DROP INDEX stayvibe_idx_stays_enquiry;
CREATE INDEX idx_stays_enquiry ON stays(enquiry_id);
DROP INDEX stayvibe_idx_stays_guest;
CREATE INDEX idx_stays_guest ON stays(guest_name);
DROP INDEX stayvibe_idx_stays_guest_id;
CREATE INDEX idx_stays_guest_id ON stays(guest_id);
DROP INDEX stayvibe_idx_stays_source;
CREATE INDEX idx_stays_source ON stays(source);
DROP INDEX stayvibe_idx_stays_status;
CREATE INDEX idx_stays_status ON stays(status);
DROP INDEX stayvibe_idx_unique_stay;
CREATE UNIQUE INDEX idx_unique_stay ON stays(villa_id, guest_name, checkin_date) WHERE status NOT IN ('cancelled', 'closed');

DROP INDEX stayvibe_idx_villa_expenses_villa_date;
CREATE INDEX idx_villa_expenses_villa_date ON villa_expenses(villa_id, date DESC);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'stayvibe_%';  -- should be empty
