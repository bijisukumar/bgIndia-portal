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

## CURRENT STATUS (update me!)  — as of 2026-07-09
- Deployed through commit `076f486`. Release 2.1 planned, not started:
  **docs/RELEASE-2.1-PLAN.md is the active spec** (table namespaces incl.
  manager_commissions rename, estate DB consolidation, index renames, config
  extraction, de-hardcode 'dwarka', hosts/<id>/config.js loader, StayVibe
  branding, onboarding docs). Target: SaaS host #1 in ~10 days.
- Owner to run when back at PC: `scripts/migrate-rubber-register.sql` on the
  ESTATES DB (adds block/rain/tapping_rate) — check if done.
- Parked: Step E contract test, receipt OCR test (Llama 4 Scout), payouts UI,
  GST (Booking.com), guest-merge repository consolidation, Last48-style raw
  `new Date(str)` audit on other screens.
- Separate project: "Project Caprock" (Caprock Cloud company merger) — its
  own conversations, not this repo.
