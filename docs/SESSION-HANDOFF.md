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
- **Release 2.1 is deployed and live on production** (merged to `main`,
  migrations run against production D1, worker + all 4 frontends deployed).
  `main` HEAD is `dde5c03`. Table-namespace prefixes, per-host config,
  `DEFAULT_VILLA_ID` de-hardcode, `platform_tenants`/`platform_auth_tokens`
  naming — all live. TestRunner suite passed post-deploy (15/15; the 1
  earlier "failure" was a stale duplicate-booking dashboard alert from
  TestRunner's own prior test run, not a bug — resolved via the existing
  "Mark resolved" control).
- **Post-deploy fixes shipped** (commits `926a42f` → `dde5c03`, all on `main`):
  - `926a42f` — added "Event & Culinary Services" to `hosts/dwarka/config.js`
    pricing extra-items list.
  - `294d8bb` — enquiry quote per-night rate was including one-time extras
    in the divisor (inflated ₹/night); fixed to room-only, and WhatsApp quote
    messages now itemize per-night rate + each extra line separately instead
    of one lumped "(all inclusive)" total.
  - `eab48e9` — Inventory Restock tab redone: Qty × Rate/Unit + GST% (pre-
    populated, overwritable) → computed Total Cost + Net ₹/Unit, replacing
    the old (confusing) Qty+TotalCost÷ flow. Catalog curated to 11 items in
    an explicit order via `sort_order`/`gst_pct` columns
    (`scripts/migrate-inventory-catalog-curated-2026-07-10.sql`, run against
    production — 5 stale items soft-archived, 3 new ones added, zero history
    lost). Also fixed a `GuestRepository.jsx` channel-badge bug (Booking.com
    guests showing "Other" — key mismatch `booking.com` vs `booking_com`)
    by switching to the shared `utils/channel.js` helper everywhere.
  - `dde5c03` — `KitchenIncidentals.jsx` (Raman's check-out screen) was
    still reading a hardcoded `INVENTORY_MASTER` snapshot instead of the
    live catalog, so it kept showing archived items regardless of the
    migration above. Switched to `api.getInventory()` (same pattern as
    `Inventory.jsx`/`PreferredStock.jsx`), added stock-on-hand + low-stock
    warning per item. Removed the now-fully-unused `INVENTORY_MASTER` export.
- **Push works directly now** — Windows Credential Manager has cached
  git credentials, so `git push origin main` succeeds without needing a
  token handed over in-session. (Earlier in the release-2.1 work, embedding
  a token in the push command or a temp credential file was blocked by the
  safety classifier as a secret-handling risk — that workaround is no
  longer needed.)
- **Done during the Release 2.1 branch work itself, in order:**
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
- **What's NOT done / still open:**
  - `scripts/migrate-resend-key-stopgap.sql` cleanup — deliberately deferred
    by the owner until after demo-onboarding was proven; that's now done,
    so this is fair game whenever someone picks it up. The real Resend key
    is already live in production (seeded 2026-07-01); the file itself is
    back to a placeholder.
  - `index.html`/PWA manifest brand strings across all 4 apps are still
    static, not `CONFIG`-driven — known, documented, deferred gap.
  - Tenant-onboarding *mechanism* (an actual in-app onboarding screen/flow
    for adding a new host, vs. today's manual "write `hosts/<id>/config.js`
    + run `scripts/onboard-new-host-seed-template.sql` by hand") — owner is
    planning to walk through adding a dummy host manually first (what goes
    in config vs. DB, how to seed it) before deciding whether/how to build
    a real onboarding screen.
  - Config-driven "starter catalog" for onboarding a new host's inventory —
    noted as a good future idea during the Inventory redesign, not built;
    today a new host starts with an empty `stayvibe_inventory` and uses the
    in-app "+ Add new item" controls.
- Parked: Step E contract test, receipt OCR test (Llama 4 Scout), payouts UI,
  GST (Booking.com), guest-merge repository consolidation, Last48-style raw
  `new Date(str)` audit on other screens.
- Separate project: "Project Caprock" (Caprock Cloud company merger) — its
  own conversations, not this repo.
