-- ============================================================
-- V2.1 MIGRATION — Seed tenants + auth_tokens tables
-- All configurable values for GVR Dwarka villa
-- Run: paste into D1 console at dash.cloudflare.com
-- ============================================================

-- Seed the tenants table with GVR Dwarka config
-- (replaces hardcoded CONFIG values in config.js and GuestFormScript.gs)
INSERT OR REPLACE INTO tenants (
  tenant_id, villa_name, owner_email, owner_email_cc,
  drive_root_id, airbnb_email,
  phone1, phone2, guest_contact,
  address, checkin_time, checkout_time,
  breakfast_rate, raman_comm_pct,
  plan, active, created_at
) VALUES (
  'dwarka',
  'Guruvayur Villa (Dwarka)',
  'kerala.luxuryvillas@gmail.com',
  'bijisukumar@gmail.com',
  '1NglE0BgsxS4wULHuO2N0ydFIErk6rrf2',
  'kerala.luxuryvillas@gmail.com',
  '+91 99950 43283',
  '+91 97287 65101',
  '+91 97287 65101',
  'Edappully Gandhinagar Rd, Palayoor, Guruvayur, Kerala 680101',
  '16:00',
  '11:00',
  275,
  10,
  'owner',
  1,
  datetime('now')
);

-- Seed auth_tokens — maps existing tokens to tenant + role
-- SYSTEM_TOKEN is the existing token used by Apps Scripts and the worker
-- Replace the token value below with your actual SYSTEM_TOKEN
INSERT OR REPLACE INTO auth_tokens (token, tenant_id, role, label, active, created_at)
VALUES
  ('06681b875f352353d02b370ba87a40ac0ad9', 'dwarka', 'system', 'Apps Script system token', 1, datetime('now'));

-- To add owner and manager tokens (replace with real PIN hash values):
-- INSERT INTO auth_tokens (token, tenant_id, role, label, active, created_at)
-- VALUES ('YOUR_OWNER_TOKEN', 'dwarka', 'owner', 'Pradosh owner login', 1, datetime('now'));
-- INSERT INTO auth_tokens (token, tenant_id, role, label, active, created_at)
-- VALUES ('YOUR_MANAGER_TOKEN', 'dwarka', 'manager', 'Raman manager login', 1, datetime('now'));
