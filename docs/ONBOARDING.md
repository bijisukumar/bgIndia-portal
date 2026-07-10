# STAYVIBE — NEW HOST ONBOARDING

Model: one host = one Pages deployment + one config + one D1 pair.
Properties within a host = villa codes. Target: intake → live in < 1 day.

**Two config layers, don't conflate them** (locked decision, Release 2.1):
static/branding config lives in `hosts/<hostId>/config.js` (git-tracked,
build-time, e.g. villas[], theme, pricing catalog); anything that must
change WITHOUT a redeploy (rates, phone numbers, check-in/checkout times)
or that's inherently dynamic (auth) lives in the `platform_tenants` /
`platform_auth_tokens` D1 tables, served via `getTenantConfig`. Both need
seeding for a new host — see step B.2 below.

## A. Intake 1-pager (host fills this — everything config needs)

**Business**
1. Host/brand name (header) · short name · tagline
2. Logo file (SVG/PNG) · brand color (optional — defaults to StayVibe theme)
3. Custom domain(s) they own (e.g. portal.<theirbrand>.com)
4. Owner name, email, WhatsApp number (guest-facing contact)

**Properties (one row per villa)** — each gets a unique villa code
5. Villa code (short, e.g. `dvarka`) · display name · full marketing name
6. Address · Google Maps link · bedrooms (+ bed type note)
7. Check-in time · check-out time · max guests
8. Rate card (nightly tariff bands) · cleaning fee · extra-charge menu with
   default prices (early check-in, floor bed, etc.)
9. Booking channels used (Airbnb / Booking.com / direct…) + commission %

**Operations**
10. Manager/staff names + roles + commission basis (per-night rate) —
    plural supported (stayvibe_manager_commissions)
11. Expense categories (or accept defaults) — stored in villa_settings
12. Breakfast rate · additional-guest rate

**Integrations**
13. Gmail address that receives channel emails (for pollers)
14. Google Drive folder for guest docs (we create structure)
15. Resend (email) — we provision; sender domain to verify

## B. Provisioning checklist (us)
1. `hosts/<hostId>/config.js` from intake (copy `hosts/dwarka/config.js` —
   the only real reference implementation as of Release 2.1 — or
   `hosts/demovilla/config.js` for a leaner from-scratch template; edit
   every field, especially `villas[].id`, which becomes the villa id used
   everywhere else below).
2. Create D1 pair `<hostId>-db`, `<hostId>-estates-db` (skip estates if
   unused); run `schema.sql` (+ `schema-estates.sql`) — these already
   define every table under its namespaced name (`stayvibe_`/`rev360_`/
   `infra_`/`platform_`/`estate360_`), so a fresh host needs no separate
   migration, just the schema files as-is. Then:
   - Seed `platform_tenants` + `platform_auth_tokens` for the new
     `tenant_id` (= the villa id from step 1) — copy
     `scripts/onboard-new-host-seed-template.sql`, fill in the
     `<PLACEHOLDER>` values, run it. This is what `getTenantConfig` serves
     to the frontend and what `GuestFormScript.gs` reads on first use.
   - Run channel/expense-category seeds as before.
3. Create Pages project `<hostId>-portal`; bind DB/DB_ESTATES/AI; set
   `[vars] DEFAULT_VILLA_ID = "<the villa id from step 1>"` in that
   project's wrangler.toml (or Pages dashboard env var) — **easy to
   forget, and if unset the worker silently falls back to `'dwarka'`
   instead of failing loudly**; secrets: PINs, RESEND_API_KEY,
   `JWT_SECRET`. Build with `VITE_HOST=<hostId>`.
4. Custom domain on Pages; SSL auto.
5. Google: deploy the 3 Apps Script projects under host's Gmail; set
   `WORKER_URL`/`TENANT_ID` (2 lines, per `scripts/GuestFormScript.gs`'s
   own header) — everything else loads dynamically via `getTenantConfig`.
6. Acceptance: run /infra TestRunner (full) + SchemaValidation → all green.
   A local dry run against `wrangler pages dev --local` before ever
   touching the real deployment is cheap insurance — see the Release 2.1
   demo-onboarding simulation for the exact recipe (login → create a
   booking → confirm isolation from any other host's data → SchemaValidation).
7. Walk host through: New Booking, Check-in flow, Expenses, Dashboard P&L.

## C. Per-villa go-live (adding property #2, #3 to an existing host)
1. Add villa object to the host's config.villas[] (code, names, address,
   maps, bedrooms, times, rate card).
2. Seed villa_settings rows for the new code (expense_categories, extras).
3. Drive folder for the villa; poller recognizes the new code.
4. TestRunner pass with the new villaId.
