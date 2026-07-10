-- ============================================================================
-- RELEASE 2.1 — TABLE NAMESPACE: stayvibe_ (villa hospitality, 24 tables)
-- ============================================================================
-- *** DO NOT RUN until the worker SQL rewrite (functions/api/[[route]].js)
-- *** targeting these new names has landed and deployed. Running this against
-- *** production before that lands will break every villa/booking action —
-- *** the currently-deployed worker still queries the OLD table names.
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-v2.1-namespace-stayvibe.sql --remote
-- Rollback: scripts/rollback-v2.1-namespace-stayvibe.sql
--
-- SQLite preserves data and keeps indexes functionally working across a
-- table rename, but each index's own name stays the OLD string (no
-- ALTER INDEX RENAME exists) — so every index is DROP + CREATE with its
-- original column list, just renamed and pointed at the new table name.
-- ============================================================================

-- ── TABLE RENAMES ──────────────────────────────────────────────
ALTER TABLE booking_line_items RENAME TO stayvibe_booking_line_items;
ALTER TABLE bookings           RENAME TO stayvibe_bookings;
ALTER TABLE campaign_analytics RENAME TO stayvibe_campaign_analytics;
ALTER TABLE cform_filings      RENAME TO stayvibe_cform_filings;
ALTER TABLE channels           RENAME TO stayvibe_channels;
ALTER TABLE checkin_links      RENAME TO stayvibe_checkin_links;
ALTER TABLE communication_log  RENAME TO stayvibe_communication_log;
ALTER TABLE duplicate_bookings RENAME TO stayvibe_duplicate_bookings;
ALTER TABLE enquiries          RENAME TO stayvibe_enquiries;
ALTER TABLE guest_documents    RENAME TO stayvibe_guest_documents;
ALTER TABLE guest_requests     RENAME TO stayvibe_guest_requests;
ALTER TABLE guests             RENAME TO stayvibe_guests;
ALTER TABLE inventory          RENAME TO stayvibe_inventory;
ALTER TABLE inventory_restock_log RENAME TO stayvibe_inventory_restock_log;
ALTER TABLE marketing_campaigns   RENAME TO stayvibe_marketing_campaigns;
ALTER TABLE payout_map         RENAME TO stayvibe_payout_map;
ALTER TABLE payouts            RENAME TO stayvibe_payouts;
ALTER TABLE raman_commissions  RENAME TO stayvibe_manager_commissions;
ALTER TABLE stay_cars          RENAME TO stayvibe_cars;
ALTER TABLE stay_incidentals   RENAME TO stayvibe_incidentals;
ALTER TABLE stays              RENAME TO stayvibe_stays;
ALTER TABLE villa_expenses     RENAME TO stayvibe_villa_expenses;
ALTER TABLE villa_rate_cards   RENAME TO stayvibe_villa_rate_cards;
ALTER TABLE villa_settings     RENAME TO stayvibe_villa_settings;

-- ── INDEX RENAMES (DROP old name + CREATE new name, same definition) ──
DROP INDEX idx_bli_stay;
CREATE INDEX stayvibe_idx_bli_stay ON stayvibe_booking_line_items(stay_id);
DROP INDEX idx_bli_type;
CREATE INDEX stayvibe_idx_bli_type ON stayvibe_booking_line_items(item_type);
DROP INDEX idx_bli_villa;
CREATE INDEX stayvibe_idx_bli_villa ON stayvibe_booking_line_items(villa_id);

DROP INDEX idx_bookings_enquiry;
CREATE INDEX stayvibe_idx_bookings_enquiry ON stayvibe_bookings(enquiry_id);
DROP INDEX idx_bookings_guest;
CREATE INDEX stayvibe_idx_bookings_guest ON stayvibe_bookings(guest_id);
DROP INDEX idx_bookings_stay;
CREATE INDEX stayvibe_idx_bookings_stay ON stayvibe_bookings(stay_id);

DROP INDEX idx_analytics_campaign;
CREATE INDEX stayvibe_idx_analytics_campaign ON stayvibe_campaign_analytics(campaign_id, event_type);
DROP INDEX idx_analytics_ts;
CREATE INDEX stayvibe_idx_analytics_ts ON stayvibe_campaign_analytics(ts);

DROP INDEX idx_cform_filings_stay;
CREATE INDEX stayvibe_idx_cform_filings_stay ON stayvibe_cform_filings(stay_id);

DROP INDEX idx_checkin_links_villa;
CREATE INDEX stayvibe_idx_checkin_links_villa ON stayvibe_checkin_links(villa_id, is_active);

DROP INDEX idx_comm_log_enquiry;
CREATE INDEX stayvibe_idx_comm_log_enquiry ON stayvibe_communication_log(enquiry_id, occurred_at);

DROP INDEX idx_dup_detected;
CREATE INDEX stayvibe_idx_dup_detected ON stayvibe_duplicate_bookings(detected_at DESC);
DROP INDEX idx_dup_source;
CREATE INDEX stayvibe_idx_dup_source ON stayvibe_duplicate_bookings(new_source, detected_at DESC);
DROP INDEX idx_duplicate_bookings_resolved;
CREATE INDEX stayvibe_idx_duplicate_bookings_resolved ON stayvibe_duplicate_bookings(resolved);

DROP INDEX idx_enquiries_followup;
CREATE INDEX stayvibe_idx_enquiries_followup ON stayvibe_enquiries(follow_up_due);
DROP INDEX idx_enquiries_guest;
CREATE INDEX stayvibe_idx_enquiries_guest ON stayvibe_enquiries(guest_id);
DROP INDEX idx_enquiries_received;
CREATE INDEX stayvibe_idx_enquiries_received ON stayvibe_enquiries(date_received);
DROP INDEX idx_enquiries_source;
CREATE INDEX stayvibe_idx_enquiries_source ON stayvibe_enquiries(source);
DROP INDEX idx_enquiries_status;
CREATE INDEX stayvibe_idx_enquiries_status ON stayvibe_enquiries(status);

DROP INDEX idx_guests_email;
CREATE INDEX stayvibe_idx_guests_email ON stayvibe_guests(email);
DROP INDEX idx_guests_phone;
CREATE INDEX stayvibe_idx_guests_phone ON stayvibe_guests(phone);

DROP INDEX idx_restock_log_villa_item;
CREATE INDEX stayvibe_idx_restock_log_villa_item ON stayvibe_inventory_restock_log(villa_id, item_id);

DROP INDEX idx_campaigns_token;
CREATE INDEX stayvibe_idx_campaigns_token ON stayvibe_marketing_campaigns(unique_token);
DROP INDEX idx_campaigns_villa;
CREATE INDEX stayvibe_idx_campaigns_villa ON stayvibe_marketing_campaigns(villa_id, is_active);

DROP INDEX idx_pmap_payout;
CREATE INDEX stayvibe_idx_pmap_payout ON stayvibe_payout_map(payout_id);
DROP INDEX idx_pmap_stay;
CREATE INDEX stayvibe_idx_pmap_stay ON stayvibe_payout_map(stay_id);

DROP INDEX idx_raman_paid;
CREATE INDEX stayvibe_idx_manager_commissions_paid ON stayvibe_manager_commissions(is_paid, checkin_date);

DROP INDEX idx_incidentals_stay;
CREATE INDEX stayvibe_idx_incidentals_stay ON stayvibe_incidentals(stay_id);

DROP INDEX idx_stays_audit;
CREATE INDEX stayvibe_idx_stays_audit ON stayvibe_stays(created_by, updated_by);
DROP INDEX idx_stays_checkin;
CREATE INDEX stayvibe_idx_stays_checkin ON stayvibe_stays(checkin_date);
DROP INDEX idx_stays_enquiry;
CREATE INDEX stayvibe_idx_stays_enquiry ON stayvibe_stays(enquiry_id);
DROP INDEX idx_stays_guest;
CREATE INDEX stayvibe_idx_stays_guest ON stayvibe_stays(guest_name);
DROP INDEX idx_stays_guest_id;
CREATE INDEX stayvibe_idx_stays_guest_id ON stayvibe_stays(guest_id);
DROP INDEX idx_stays_source;
CREATE INDEX stayvibe_idx_stays_source ON stayvibe_stays(source);
DROP INDEX idx_stays_status;
CREATE INDEX stayvibe_idx_stays_status ON stayvibe_stays(status);
DROP INDEX idx_unique_stay;
CREATE UNIQUE INDEX stayvibe_idx_unique_stay ON stayvibe_stays(villa_id, guest_name, checkin_date) WHERE status NOT IN ('cancelled', 'closed');

DROP INDEX idx_villa_expenses_villa_date;
CREATE INDEX stayvibe_idx_villa_expenses_villa_date ON stayvibe_villa_expenses(villa_id, date DESC);

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'stayvibe_%' ORDER BY name;
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'stayvibe_%' ORDER BY name;
