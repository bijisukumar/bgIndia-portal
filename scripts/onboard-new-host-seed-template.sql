-- ============================================================================
-- NEW TENANT ONBOARDING — platform_tenants / platform_properties /
-- platform_auth_tokens seed template
-- ============================================================================
-- Copy this file (don't edit in place), fill in every <PLACEHOLDER>, then:
--   npx wrangler d1 execute bgindia-db --file=scripts/onboard-<tenantId>-seed.sql --remote
--
-- This is the DB-side half of onboarding (see docs/ONBOARDING.md). The
-- other half is hosts/<hostId>/config.js — that file holds static/branding
-- config (colors, logos, pricing rate cards); this seed holds tenant
-- billing/profile data, which properties the tenant owns, and login
-- credentials (hashed PINs) scoped to this tenant.
--
-- ── STEP 1: pick PINs and hash them first ──────────────────────────────
-- PINs are never stored in plaintext (platform_auth_tokens.token_hash is
-- a SHA-256 hex digest). Compute each hash with Node before filling in
-- the INSERT below — same SHA-256 algorithm the worker uses
-- (functions/api/[[route]].js's hashPin()), so the output matches exactly:
--
--   node -e "console.log(require('crypto').createHash('sha256').update('<CHOSEN_PIN>').digest('hex'))"
--
-- Do this once per PIN (owner, manager, etc.) and paste each hash below.
-- ============================================================================

-- ── platform_tenants: billing/profile record ────────────────────────────
INSERT INTO platform_tenants (
  tenant_id, villa_name, owner_email, owner_email_cc,
  drive_root_id, airbnb_email,
  phone1, phone2, guest_contact,
  address, checkin_time, checkout_time,
  breakfast_rate, raman_comm_pct,
  plan, active, created_at,
  billing_contact_name, billing_email, primary_hostname
) VALUES (
  '<TENANT_ID>',                    -- also used as this tenant's default property_id below
  '<VILLA_DISPLAY_NAME>',           -- e.g. 'Sunset Villa (Alibaug)'
  '<OWNER_EMAIL>',                  -- receives alerts + guest form notifications
  '<OWNER_EMAIL_CC>',               -- CC'd on all owner emails (can equal OWNER_EMAIL)
  '<GOOGLE_DRIVE_ROOT_FOLDER_ID>',
  '<AIRBNB_NOTIFICATION_EMAIL>',    -- inbox the Airbnb reservation poller watches
  '<PHONE_1>',                      -- villa landline / main
  '<PHONE_2>',                      -- owner mobile (operations)
  '<GUEST_CONTACT_PHONE>',          -- shown to guests for queries
  '<FULL_ADDRESS>',
  '<CHECKIN_TIME_24H>',             -- e.g. '16:00'
  '<CHECKOUT_TIME_24H>',            -- e.g. '11:00'
  <BREAKFAST_RATE_INR>,             -- integer, ₹ per person per day
  <MANAGER_COMMISSION_PCT>,         -- integer, % commission for on-site manager
  'starter',                        -- plan tier — adjust once plans are differentiated
  1,
  datetime('now'),
  '<BILLING_CONTACT_NAME>',
  '<BILLING_EMAIL>',                -- can equal OWNER_EMAIL if there's no separate billing contact
  '<TENANT_ID>.stayvibe360.com'     -- e.g. 'dwarka.stayvibe360.com'
);

-- ── platform_properties: which unit(s) this tenant owns ─────────────────
-- Start with one row (unit_type 'villa' or 'room'); add more rows here
-- any time this tenant adds properties later — no code deploy needed,
-- the picker/auth system picks up new rows immediately.
INSERT INTO platform_properties (property_id, tenant_id, name, unit_type, active, created_at)
VALUES ('<TENANT_ID>', '<TENANT_ID>', '<VILLA_DISPLAY_NAME>', 'villa', 1, datetime('now'));

-- ── platform_auth_tokens: login credentials, scoped to this tenant ──────
-- actor is the short internal slug some estate/manager-routing logic keys
-- off (only matters if this host ever needs per-manager estate-style
-- routing — for a normal villa host, actor can just equal role).
INSERT INTO platform_auth_tokens (token_hash, tenant_id, role, actor, label, active, created_at)
VALUES
  ('<OWNER_PIN_HASH>',   '<TENANT_ID>', 'owner',   'owner',   '<Owner name>',   1, datetime('now')),
  ('<MANAGER_PIN_HASH>', '<TENANT_ID>', 'manager', 'manager', '<Manager name>', 1, datetime('now'));

-- Verify after running:
SELECT * FROM platform_tenants WHERE tenant_id = '<TENANT_ID>';
SELECT * FROM platform_properties WHERE tenant_id = '<TENANT_ID>';
SELECT token_hash, tenant_id, role, actor, label, active FROM platform_auth_tokens WHERE tenant_id = '<TENANT_ID>';
