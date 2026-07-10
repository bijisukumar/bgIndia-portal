-- STOPGAP: stores the Resend API key in the DB as a fallback, because
-- env.RESEND_API_KEY is confirmed bound in Cloudflare's dashboard but not
-- reaching the live Pages Function's runtime env (platform-side issue,
-- support ticket filed 2026-07-01). sendAlert() checks env first, then
-- falls back to this row. Remove this row and revert to the env secret
-- once Cloudflare resolves the ticket.
--
-- BEFORE RUNNING: replace YOUR_RESEND_API_KEY_HERE below with your actual
-- Resend API key. Edit this file locally — do not paste the key anywhere
-- else (chat, issue trackers, etc).
--
-- Run: npx wrangler d1 execute bgindia-db --file=scripts/migrate-resend-key-stopgap.sql --remote
--
-- Already applied to production 2026-07-01 (row confirmed present,
-- 2026-07-10) — this file is kept as a reusable template for re-seeding
-- or seeding a new host's key, not something that needs re-running as-is.
INSERT OR REPLACE INTO stayvibe_villa_settings (villa_id, key, value, updated_by, updated_at)
VALUES ('dwarka', '_resend_api_key', 'YOUR_RESEND_API_KEY_HERE', 'system', datetime('now'));
