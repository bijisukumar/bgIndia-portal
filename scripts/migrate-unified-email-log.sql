-- ============================================================
-- Unified email log — 2026-07-12
-- ============================================================
-- Extends the existing infra_alert_log (currently only populated by
-- the Worker's own sendAlert() for owner-facing Resend emails) so it
-- can also hold guest-facing emails sent via the same pipeline, once
-- GuestFormScript.gs / PollNewReservationAndProcess.gs stop calling
-- GmailApp.sendEmail directly and call the new sendGuestEmail Worker
-- action instead. One table, one place to browse/truncate all sent
-- email, regardless of who it went to.
--
-- category lets the log distinguish guest vs owner vs security email
-- without needing a second table. email_retention_days on
-- platform_tenants is the configurable-per-tenant truncation window
-- (default 90) the cleanup job reads.
-- ============================================================

ALTER TABLE infra_alert_log ADD COLUMN category TEXT DEFAULT 'general';

ALTER TABLE platform_tenants ADD COLUMN email_retention_days INTEGER DEFAULT 90;

CREATE INDEX IF NOT EXISTS infra_idx_alert_log_category ON infra_alert_log(category, created_at DESC);
