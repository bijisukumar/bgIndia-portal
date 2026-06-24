-- Migration: add follow-up reminder tracking to enquiries
-- Run via D1 Admin / D1 console. Plain sequential statements only.
--
-- Without these, a daily check for "days since contact >= 2" would stay
-- true every single day after day 2 and re-send the same reminder email
-- indefinitely. These columns let the Apps Script remember which
-- threshold has already been emailed for a given enquiry, and reset
-- automatically once last_contact_date moves forward (e.g. after a
-- Nudge is sent or any other contact is logged).
ALTER TABLE enquiries ADD COLUMN reminder_2day_sent_at TEXT;  -- timestamp, NULL until sent
ALTER TABLE enquiries ADD COLUMN reminder_5day_sent_at TEXT;  -- timestamp, NULL until sent

-- Verify after running:
-- SELECT enquiry_id, guest_name, status, last_contact_date,
--        reminder_2day_sent_at, reminder_5day_sent_at
-- FROM enquiries;
