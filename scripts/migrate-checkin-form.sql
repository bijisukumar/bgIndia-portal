-- ============================================================
-- MIGRATION: Guest Check-in Form — Form C Compliance
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-checkin-form.sql --remote
-- Date: 2026-05-24
-- ============================================================

-- Indian guest fields
ALTER TABLE stays ADD COLUMN dob TEXT;
ALTER TABLE stays ADD COLUMN gender TEXT;
ALTER TABLE stays ADD COLUMN nationality TEXT DEFAULT 'Indian';
ALTER TABLE stays ADD COLUMN purpose_of_visit TEXT;
ALTER TABLE stays ADD COLUMN mode_of_transport TEXT;
ALTER TABLE stays ADD COLUMN vehicle_number TEXT;
ALTER TABLE stays ADD COLUMN eta TEXT;
ALTER TABLE stays ADD COLUMN guest_list TEXT;

-- Foreign guest fields (Form C)
ALTER TABLE stays ADD COLUMN passport_number TEXT;
ALTER TABLE stays ADD COLUMN passport_issue_date TEXT;
ALTER TABLE stays ADD COLUMN passport_issue_place TEXT;
ALTER TABLE stays ADD COLUMN passport_expiry TEXT;
ALTER TABLE stays ADD COLUMN visa_number TEXT;
ALTER TABLE stays ADD COLUMN visa_type TEXT;
ALTER TABLE stays ADD COLUMN visa_issue_date TEXT;
ALTER TABLE stays ADD COLUMN visa_issue_place TEXT;
ALTER TABLE stays ADD COLUMN arrival_date_india TEXT;
ALTER TABLE stays ADD COLUMN port_of_arrival TEXT;
ALTER TABLE stays ADD COLUMN next_destination TEXT;
ALTER TABLE stays ADD COLUMN home_country_address TEXT;

-- Form submission tracking
ALTER TABLE stays ADD COLUMN checkin_form_submitted INTEGER DEFAULT 0;
ALTER TABLE stays ADD COLUMN checkin_form_submitted_at TEXT;
