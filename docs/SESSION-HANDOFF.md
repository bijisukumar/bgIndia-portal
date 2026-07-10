# SESSION HANDOFF — read me first (standing context)

Paste to a new session: "Read docs/SESSION-HANDOFF.md in
github.com/bijisukumar/bgIndia-portal (main) and continue from CURRENT STATUS."
Update this file at every release milestone — never re-tell the story in chat.

## The system
- **Repo:** github.com/bijisukumar/bgIndia-portal (main). Cloudflare Pages +
  Functions. Worker: `functions/api/[[route]].js` (single-file API, action
  param). Frontend: 4 Vite apps — stayvibe (villa PMS), estate360, rev360
  (rentals), manage (owner home). Screens in `src/screens/*`, shared API layer
  `src/api/index.js`, central config `src/config.js`.
- **DBs (D1/SQLite):** `bgindia-db` (binding DB — villa + rental + infra) and
  `bgindiadb-estates` (binding DB_ESTATES — estate actions via ActiveDB).
- **Live URLs:** manage/stayvibe/estate360 apps under
  *.luxuryvillasofguruvayur.com (owner portal at manage., guest-facing villa
  app at stayvibe.).
- **Google side:** 3 Apps Script projects under kerala.luxuryvillas@gmail.com
  (pollNewReservations 5-min email poller; processPendingCheckInForms;
  GVR form onSubmit). They call the portal API by action name — never SQL.
- **People:** Owner = Biji (Coppell, TX; IST-night deploys preferred).
  Raman = on-site villa manager (own app flows; being generalized to
  "manager" for SaaS). Estates managers: Pradosh (Pollachi/coconut),
  RamananKutty (Pavutumuri/rubber).

## Workflow (established)
- Edit → check (`node --check` worker; `npx esbuild <file> --loader:.jsx=jsx
  --jsx=automatic` for screens) → commit `fix()/feat()/data()/docs()` with
  thorough message → push → re-sanitize remote URL after push.
- **Push token: NEVER in this repo (it's public).** Owner supplies it in
  session when pushing is needed; rotate periodically.
- DB changes ship as scripts in `scripts/` (preview → apply → verify
  pattern); owner runs them via `npx wrangler d1 execute <db> --file=... --remote`
  and pastes output. `--file` never prints SELECTs — use `--command` for
  reads. D1 caps compound SELECTs — avoid long UNION chains (use json_each).
- Validation: /infra TestRunner (live API suite) + SchemaValidation
  (schemaContracts.js).

## Architecture decisions (stable)
- **Money:** booking_line_items ledger is source of truth; stays
  gross/commission/net are roll-ups (spec: docs/DB-Ledger-Refactor-Spec.md).
  `syncStayLedger()` runs after every financial write; net = gross −
  commission by construction. Extras = upsell (P&L breakout). Passthrough
  (guest fees) excluded from P&L.
- Agent bookings: booked-by link + absorbDuplicateStay (move money, void
  duplicate). Void = duplicate/mistake; cancelled = lost booking.
- Dates: always parseLocalDate/fmtDate (UTC off-by-one for US owner).
- Per-villa config data in villa_settings (expense_categories, activity_ack).
- Rubber register: block/rain/rate columns; monthly classification
  tapping/maintenance/rain; sale calculator → estate_transactions.

## CURRENT STATUS (update me!)  — as of 2026-07-10
- **Deployed/live production is still on commit `076f486`. Everything below
  is uncommitted, on branch `release/2.1-tables` (67 files changed), never
  pushed, never run against production.** Release 2.1 (`docs/RELEASE-2.1-PLAN.md`)
  is essentially code-complete; what's left is entirely the deploy step.
- **Done this session, in order:**
  1. File-based per-host config: `hosts/dwarka/config.js` (+ `hosts/demovilla/config.js`,
     a throwaway simulation host — see below), `src/config.js` collapsed to a
     1-line re-export via a `@host-config` Vite alias (all 4 vite.*.config.js).
     Folded in stragglers: `arrivalMessage.js`, `villaPricing.js`, rubber
     defaults, `EstateLedger.jsx` categories.
  2. DB table-namespace migrations written (not yet run): `stayvibe_`/`rev360_`/
     `infra_`/`platform_`/`estate360_` prefixes across all ~46 tables in both
     DBs, in `scripts/migrate-v2.1-namespace-*.sql` + matching rollbacks, plus
     `scripts/migrate-v2.1-drop-stale-estate-tables.sql` (5 confirmed-0-row
     stale estate copies in bgindia-db). **`tenants`/`auth_tokens` got their
     own `platform_` prefix**, not `infra_` — decided mid-session, distinct
     from shared logging tables. `schema.sql`/`schema-estates.sql` fully
     regenerated from live production schema (were badly stale — 19 tables
     existed live but were never in these files).
  3. Worker SQL rewrite: `functions/api/[[route]].js` — every genuine SQL
     table reference (not JS vars/comments/API fields) renamed to match,
     via a keyword-anchored scripted pass (`FROM`/`INTO`/`UPDATE`/`JOIN`,
     exact-case only — verified no genuine lowercase SQL exists in the file).
  4. `'dwarka'` de-hardcoded: new `src/utils/villaContext.js` exports
     `DEFAULT_VILLA_ID` (from `CONFIG`); worker reads `env.DEFAULT_VILLA_ID`
     (added to all 4 `wrangler*.toml` under `[vars]`, currently `"dwarka"` —
     zero behavior change today, but required for a second host).
  5. Verified schema.sql/schema-estates.sql for real: applied to local D1
     (`wrangler d1 execute --local`), confirmed `REQUIRED_TABLES`/`CONTRACTS`
     (`schemaContracts.js`, already updated) match exactly.
  6. **Demo-onboarding simulation** (local D1 + `wrangler pages dev --local`,
     zero production contact): created a second tenant (`demovilla`) end to
     end — config, `platform_tenants`/`platform_auth_tokens` seed, real
     login, real booking creation — and proved data isolation both
     directions. Found and fixed real bugs along the way (see below).
  7. `docs/ONBOARDING.md` updated to match reality (was written before this
     session, referenced `hosts/guruvayur`/no `platform_tenants` step); new
     `scripts/onboard-new-host-seed-template.sql` (parameterized, replaces
     hand-writing a seed per host); old `docs/onboarding-config.md` marked
     superseded, kept for historical reference only.
- **Bugs found + fixed this session, unrelated to the Release 2.1 work itself
  but surfaced by it** (all in `functions/api/[[route]].js`, all local-verified):
  - `rubber_production`/`manager_settlements` never existed in the ESTATES DB
    (bgindiadb-estates) — only stale 0-row copies in bgindia-db.
    `scripts/migrate-rubber-register.sql` is obsolete (had a typo'd DB name
    too); `scripts/migrate-rubber-estates-tables-fix.sql` fixed it — **this
    one WAS run against production already**, before the branch work started.
  - `getLowStockItems`/`getManagerSettlements`/`getRubberMonthly`/
    `getRubberProduction` were implemented inside the `POST` method block but
    called via HTTP GET from the frontend — all 404'd in production.
    Relocated to the GET block.
  - `getRubberMonthly` also wasn't in the `ESTATE_ACTIONS` set (so even after
    the above fix it'd hit the wrong DB) — added it.
  - Several screens (`MarketingCampaigns.jsx`, `RamanHome.jsx`, `Login.jsx`,
    `GuestCheckIn.jsx`) hardcoded `'Guruvayur Estates'` directly, bypassing
    `CONFIG` — fixed. `RamanHome.jsx` also referenced a `CONFIG.villaName`
    field that never existed. Added `CONFIG.landingUrl` (was hardcoded to
    dwarka's real domain inside campaign tracking links).
- **What's NOT done — the actual next step**: run the migrations against
  production D1 + merge/deploy the branch, in one IST-night window (per
  `docs/RELEASE-2.1-PLAN.md` §3 — DB and worker must land together). Also
  still open: confirming `platform_tenants`/`platform_auth_tokens` naming
  decision with the owner one more time before it's locked in production
  (proceeded with `platform_` per owner's "keep going" pacing when the
  direct question went unanswered — cheap to change now, expensive after).
  `index.html`/PWA manifest brand strings across all 4 apps are still
  static, not `CONFIG`-driven — known, documented, deferred gap.
- Parked: Step E contract test, receipt OCR test (Llama 4 Scout), payouts UI,
  GST (Booking.com), guest-merge repository consolidation, Last48-style raw
  `new Date(str)` audit on other screens.
- Separate project: "Project Caprock" (Caprock Cloud company merger) — its
  own conversations, not this repo.
