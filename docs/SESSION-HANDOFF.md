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

## Stay data is no longer one table (2026-08-17)
`stayvibe_stays` hit **D1's 100-column ALTER TABLE ceiling** — ADD COLUMN
fails outright past it. Split to **77 columns** by dropping 4 genuinely dead
ones and moving two cold blocks into 1:1 side tables:

- `stayvibe_stay_kyc` — passport/visa/immigration (was filled on 2 of 313 rows)
- `stayvibe_stay_prefs` — breakfast/cab/extra beds (0 of 313)
- `stayvibe_stay_ext` — `late_checkout_nights`, `occupancy_tax`, and wherever
  the next per-stay field should go. **Add new fields here, not to
  stayvibe_stays.**

Rows are created lazily — a domestic booking writes no KYC row at all. Reads
that need them LEFT JOIN with COALESCE so a stay lacking a side row still
appears. Deletes are **explicit** in the worker's hard-delete cascade, never
ON DELETE CASCADE: D1 does not guarantee `PRAGMA foreign_keys=ON`.

Beware `SELECT *` on stayvibe_stays — 13 such sites exist, and a moved column
silently stops appearing rather than erroring.

## Money rules that are easy to get wrong
- **Extended-stay quotes (25%/50%)** are a share of what the **guest paid**,
  not of what we net — and **occupancy tax is excluded** (government money,
  not the value of the room). Direct bookings use gross; channel bookings use
  `guest_paid_total + extra_charges`, minus tax.
- **`night_fee` is the TOTAL room fee for the stay, not per night.** Confirmed
  against four multi-night rows where guest_paid − night_fee − cleaning −
  guest_service_fee lands on exactly 0.00. Multiplying it by nights produces
  wildly wrong figures and only looks right on one-night stays.
- **Occupancy tax** (Airbnb started collecting it) is stored in
  `stayvibe_stay_ext.occupancy_tax`, falling back to the residual
  `guest_paid_total − night_fee − cleaning_fee − guest_service_fee` for older
  rows. Prefer the stored value: a residual silently absorbs any new line
  Airbnb adds.
- **Manager commission** is per stay serviced, not per night blocked: a night
  held only for a late check-out must not tip a 1-night stay into the 2,000
  band. See `late_checkout_nights`.

## Phone numbers have one normaliser
Guests type India's trunk `0` constantly; `wa.me` rejects it, so the guest
becomes silently unmessageable. `normalizeStoredPhone()` (worker) and
`waNumber()` (`src/utils/guestMessages.js`) strip trunk prefixes **before**
the is-this-international length test. Every write path into `guest_phone`
goes through it. Do not reintroduce a local copy — there were six.

## Public endpoints and their trust model
`/flexibility` (guest-facing) calls **`findMyBooking`**, which is public, so
**the matching IS the security**: both dates and the contact must match
exactly, only the name is fuzzy, and a miss returns a bare `found:false` —
never which half matched, or it becomes a way to enumerate guests. Do not
loosen. Other public actions: `submitGuestCheckIn`, `resolveCheckinLink`,
`getAgentQuote`, `submitFlexRequest`, `runCheckoutEmailAutosend`
(CRON_SECRET-guarded).

## Deploy commands — the directory is NOT interchangeable
Each Vite config writes to its own `dist/<app>` subfolder; only `build:manage`
writes to `dist` itself. `wrangler pages deploy dist` therefore uploads the
**manage** build, and pointing that at any other project silently replaces
that site with the owner portal — the app still loads, the API still answers,
only the wrong frontend is served. Deploy the app's own subfolder:

```
npm run build:stayvibe  && npx wrangler pages deploy dist/stayvibe   --project-name=stayvibe          --branch=main --commit-dirty=true
npm run build:rev360    && npx wrangler pages deploy dist/rev360     --project-name=rev360-gvr        --branch=main --commit-dirty=true
npm run build:estate360 && npx wrangler pages deploy dist/estate360  --project-name=estate360         --branch=main --commit-dirty=true
npm run build:demovilla && npx wrangler pages deploy dist/demovilla  --project-name=demovilla-portal  --branch=main --commit-dirty=true   # + wrangler.toml swap
npm run build:manage    && npx wrangler pages deploy dist            --project-name=bgindia-portal    --branch=main --commit-dirty=true
```

Verify after deploying — the title is the cheapest tell that the right build
landed (`StayVibe — Villa Management` vs `Guruvayur Estates Portal`):

```
curl -s https://dwarka.stayvibe360.com/ | grep -o "<title>[^<]*</title>"
```

`build:manage` empties `dist` including the sibling subfolders, so build each
app immediately before its own deploy rather than batching all builds first.

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

## Form C is per foreign national (2026-08-18)

Indian law requires a **separate Form C for every foreign national** staying at
the property, not just the person who made the booking. The KYC table was keyed
`stay_id PRIMARY KEY`, which structurally allowed exactly one — so a family of
four foreigners could only ever have one filing.

`stayvibe_stay_kyc` is now **one row per guest**, keyed `(stay_id, guest_seq)`:

- `guest_seq = 1` is whoever filled the check-in form (sections 4–6).
- `guest_seq = 2..N` are the companions added in section 7, "Other foreign guests".
- Each row carries its own name, nationality, DOB, gender, passport, visa and
  arrival details. Domestic parties write **no rows at all**.
- `stayvibe_guest_documents` gained `guest_seq`, so each passport/visa scan is
  attributable to the person it belongs to.

`writeFormCGuests()` rewrites the whole set rather than upserting row by row:
if a guest re-submits with a companion removed, that companion's row must
disappear, otherwise a stale foreign national stays on the filing.

**`docs_later` is enforced server-side.** When a guest ticks "submit visa
documents at check-in", the worker nulls the visa columns regardless of what
the payload contained. The form already blanks them, but this is a public
endpoint and it must not be possible to store visa details against a guest
flagged as not having supplied them. A direct-POST test proved the client-side
strip alone was insufficient.

Read it back with `getFormCGuests?stayId=...` (authed, property-scoped). Before
this endpoint the KYC table was **write-only** — data was captured but nothing
could retrieve it, which meant it could not actually be used for the filing.
The owner sees it as a "FORM C · FOREIGN NATIONALS" card on Complete Booking,
which flags both missing guests and missing scans.

**Not deployed: demovilla.** Its worker still runs the pre-Form-C bundle. The
database (`demovilla-db`) has been migrated and was also missing
`stayvibe_stay_kyc`/`stayvibe_stay_prefs` entirely from the earlier column
split, so prefs writes there had nowhere to land. Deploying it needs the
`wrangler.toml` DB-binding swap, which is a manual step.

## Home address is no longer India-only (2026-08-18)

Section 2 of the check-in form assumed an Indian address: one street line, a
`Bengaluru` placeholder, a 6-digit numeric PIN, and a hardcoded `country:
'India'` in the payload. An Indian national living abroad — the NRI/OCI case —
had nowhere to put a real address.

Now: **Street address 1**, **Street address 2**, City, **Pincode / ZIP code**,
State and **Country**. The state field switches between the Indian-states
dropdown and a free-text "State / Province" as the country changes. The
pincode field lost `type=tel` and `maxLength={6}` — both were Indian-PIN
assumptions that silently truncated ZIP+4 and rejected the alphanumeric
postcodes used in the UK, Canada and the Netherlands.

`stayvibe_stays.home_address_line2` is the only new column (78/100 used).
`country` now carries the guest's actual address country instead of a constant.
The foreign-guest branch is untouched: for them `city/state/pincode/country`
deliberately remain the VILLA's India address, which is what Form C asks for,
and a separate `addrCountry` state keeps the two from colliding.

Verified on production through both worker branches: INSERT stored
`1200 Market Street / Apartment 14B / San Francisco / California / 94105-2100 /
United States`, and a follow-up UPDATE correctly rewrote it to the Boston
address. Placeholder/bind arity was checked programmatically on both
statements (30/30 and 29/29) before deploying — a miscount there breaks every
check-in.

**demovilla could not take this column**: `ALTER TABLE` fails with
`too many columns on sqlite_altertab_stayvibe_stays`. That database never got
the column split, so its stays table is still at the 100-column ceiling. It
needs the same split applied before it can take this column or the current
worker bundle.

**Owner UI shows city only — this is a decision, not a gap.** `getUpcomingStays`
returns `from_city` and nothing else of the address. The full address (street 1,
street 2, city, state, pincode, country) IS captured and verified on both the
insert and update paths; Biji reviewed this on 2026-08-23 and confirmed city is
all the owner screen needs. Do not "fix" this by widening the query — the data
is in `stayvibe_stays` for anyone who needs it.

## Multi-machine hazard: ALWAYS `git fetch` before building (2026-08-20)

Two Claude sessions work this repo from different machines. One of them built,
deployed and **migrated production** from a clone that was 22 commits behind
`origin/main`, without ever checking. Consequences, in order of severity:

1. **Production was broken for foreign guests.** The Form C migration rebuilt
   `stayvibe_stay_kyc` so `stay_id` is no longer uniquely indexed, but the
   *deployed* worker was the older `origin/main` build, which still upserts
   with `ON CONFLICT(stay_id)`. Every foreign check-in returned
   `D1_ERROR: ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE
   constraint`. Domestic guests were unaffected — their path writes no KYC row.
2. **Four Pages projects briefly served a 22-commit-stale build**, silently
   reverting car capture, Staff & Access, dashboard fixes and more. This
   self-healed when the other machine redeployed.
3. Schema changes do **not** self-heal. A redeploy overwrites code; it cannot
   undo a migration. That asymmetry is the whole lesson.

**Rule: `git fetch && git status -sb` before any build, deploy or migration.**
If the branch is behind, rebase first. Never migrate production while the
deployed worker is code you have not read.

Resolution: rebased the 3 local commits onto `origin/main` (one conflict, in
the `stayvibe_stays` line of `schema.sql` — kept origin's `checked_in_by` /
`checked_out_by` and added `home_address_line2`), verified both sides' features
survived the auto-merge in `[[route]].js` and `CompleteBooking.jsx`, re-checked
SQL placeholder/bind arity (30/30 and 29/29), pushed, and deployed all four
projects. Verified against the live domain that the served bundle contains both
the Form C section and origin's car capture.

## Form C invariant: the two nationality flows must never criss-cross

Form C applies to foreign nationals. An Indian guest must carry **no** Form C
row and **no** passport/visa scan; a foreign guest must carry no Indian ID.
This kept breaking because state and payload survived a nationality switch.

Four leaks existed, all now closed:

1. **`setNationality` was a bare setter.** Switching branch cleared nothing, so
   a guest who opened the Foreign flow, uploaded a passport, then corrected to
   Indian still submitted passport data. `switchNationality()` now wipes the
   opposite branch — including file inputs — in both directions.
2. **The three file uploads were ungated.** `idFileB64`/`passportFileB64`/
   `visaFileB64` were sent unconditionally while every *typed* field was gated
   on `isForeign`. The scans crossed even when the fields didn't.
3. **The worker inferred foreignness from the passport field**
   (`primaryIsForeign = !!passportNumber`). Nationality is now the authority:
   `declaredForeign` is true for anything not explicitly "Indian", so a client
   sending a country name still files correctly, and an Indian guest with a
   passport number never produces a Form C row.
4. **Cleanup deleted rows but not scans — and ran too early.** The domestic
   cleanup at the Form C block deleted `passport`/`visa` documents, but the
   document-storage block runs ~70 lines *later* and re-inserted them. Storage
   is now gated on `declaredForeign` so they are never written; the delete
   handles historical rows. The mirror case (stale `govt_id` on a foreign
   registration) is cleaned too.

An Indian guest choosing "Passport" as their ID is unaffected — that is stored
as `doc_type = 'govt_id'`, never `'passport'`.

Verified on production with a criss-cross matrix that posts payloads a
misbehaving client would send (the other branch's data still attached), plus
the real correction sequence: submit Foreign with a companion and scans, then
resubmit the same stay as Indian — result is 0 Form C rows, 0 foreign scans,
1 Aadhaar. Server-side gating is deliberate: the form now prevents this at
source, but this is a public endpoint and must not depend on the client.

Note: one matrix case failed on first run purely from Pages deploy propagation
(first request after deploy hit the old worker). Re-running the same code
passed. Worth waiting a few seconds before testing a fresh deploy.

## How deploys actually happen (2026-08-25)

**Four Pages projects auto-deploy from GitHub on every push to `main`:**
`stayvibe`, `bgindia-portal`, `rev360-gvr`, `estate360`. They are connected to
`bijisukumar/bgIndia-portal`. `demovilla-portal` and `stayvibe-site` are not
connected and only move when someone runs wrangler by hand.

**Pushing is deploying.** For the four connected projects a manual
`wrangler pages deploy` and the git build race each other, and whichever lands
last wins — normally the git build, because it starts on push and finishes
later. This is not theoretical; it produced a real incident:

> A manual deploy from a clone 22 commits behind was believed to have been
> "overwritten by the other machine". It had not been. The other machine
> *pushed*, GitHub built, and that build replaced the manual upload. The
> mechanism was invisible because nobody had written down that the git
> integration existed.

Practical rules:

- For the four connected projects, **push and let the build run.** Only deploy
  manually to force a specific tree live ahead of a push, and expect the next
  push to replace it.
- After any deploy, verify against the **real domain**, not the deploy output:
  fetch the served bundle and grep for a string the change introduced. The
  deploy message tells you an upload succeeded, not that the domain serves it.
- Pages propagation lags a few seconds. A test fired immediately after a deploy
  can hit the previous worker — this produced a false "still leaking" result
  during the Form C criss-cross work. Re-run before investigating.

### The marketing site lives in its own repository

`www.stayvibe360.com` is **not** in this repo. It is
`bijisukumar/stayvibe-web` → Pages project `stayvibe-web`, auto-deploying on
push. It used to live here as `marketing-site/`, and could not be made safe:

**Cloudflare Pages reads `wrangler.toml` from the repository root, and the
project's "Root directory" setting does not redirect that.** A Pages project
building the site from inside this repo inherited the portal's
`pages_build_output_dir = "dist"` *and its bindings* — `DB → bgindia-db`,
`DB_ESTATES`, Workers AI. Because a `wrangler.toml` was in play, those bindings
became locked in the dashboard and could not be deleted. The first CLI deploy
also bundled this repo's `functions/`, putting `POST /api/submitGuestCheckIn`
on the public marketing domain.

No configuration fixes that from inside this repo. A separate repository with
no root `wrangler.toml` and no `functions/` has nothing to inherit — its
bindings list is empty and editable. **Do not add a `wrangler.toml` to
`stayvibe-web`**; its absence is what keeps the dashboard fields free.

After any marketing-site change, the two checks that matter:

```
curl -s https://www.stayvibe360.com/ | grep -o "<title>[^<]*</title>"   # marketing title
curl -s -o /dev/null -w "%{http_code}
" -X POST https://www.stayvibe360.com/api/x   # must be 405
```

A 405 means static assets only. JSON or a 401 means a worker has attached
itself and the isolation has broken again.

### Project → domain map

| Pages project | Serves | Git |
|---|---|---|
| `stayvibe` | dwarka.stayvibe360.com (portal, worker, D1) | auto |
| `bgindia-portal` | manage.stayvibe360.com | auto |
| `rev360-gvr` | rev360.luxuryvillasofguruvayur.com | auto |
| `estate360` | estate360.luxuryvillasofguruvayur.com | auto |
| `stayvibe-web` | stayvibe360.com + www — **separate repo** `stayvibe-web` | auto |
| `demovilla-portal` | demo.stayvibe360.com | manual — see below |

`stayvibe` and the marketing project read similarly in the dashboard list and
were confused once: both apex domains were attached to the portal by mistake
and served the check-in app at www.stayvibe360.com. The tell is the CNAME
target — `stayvibe-gvr.pages.dev` is the portal, `stayvibe-web.pages.dev` is
the marketing site. (The interim `stayvibe-site` project was deleted; it held
the poisoned bindings.)

Correction to an earlier note: Pages projects **can** be renamed in place
(Settings → General → Rename). `stayvibe` is still left alone, but because it
serves every check-in link already sent to guests, not because renaming is
impossible.

## demovilla brought to parity (2026-08-25)

`demovilla-db`'s `stayvibe_stays` was stuck at exactly **100 columns** — SQLite's
`ALTER TABLE ADD COLUMN` ceiling — because it never received the column split
that moved KYC and preferences into side tables. It could not take another
column, so it could not run the current worker, and the demo shown to
prospective hosts was several features behind the product being sold.

Rebuilt to production parity: **81 columns** (19 of headroom), 23 dead columns
dropped, 4 gained (`home_address_line2`, `checked_in_by`, `checked_out_by`,
`no_show`), plus the four tables it never had (`stay_ext`, `flex_requests`,
`ical_feeds`, `ical_blocks`). All 156 stays preserved.

Two things that will bite again:

1. **`DROP TABLE stayvibe_stays` fails on a foreign key.** Four tables
   reference it, and `stayvibe_incidentals` had 32 rows. `PRAGMA
   defer_foreign_keys=ON` is **not honoured** by D1 in a `--file` execution.
   The migration parks those rows in a temp table, rebuilds, then restores
   them — the referenced stay_ids survive, so every reference resolves.
2. **Never deploy demovilla from the repo root.** The root `wrangler.toml`
   binds `DB → bgindia-db`; deploying demovilla with it in scope points the
   demo at the production database. There is no `--config` flag on
   `wrangler pages deploy`.

The safe deploy stages an isolated tree — no swap of the repo's `wrangler.toml`,
so it can never be left pointing at the wrong database:

```
npm run build:demovilla
mkdir -p /tmp/dv && cd /tmp/dv
cp <repo>/wrangler.demovilla.toml wrangler.toml
cp -r <repo>/functions <repo>/hosts .          # the worker imports hosts/*/config.js
mkdir -p dist && cp -r <repo>/dist/demovilla dist/demovilla
npx wrangler pages deploy dist/demovilla --project-name=demovilla-portal --branch=main --commit-dirty=true
```

`hosts/` is easy to forget — without it the build fails on
`Could not resolve "../../hosts/dwarka/config.js"`.

Verified after deploy: the demo serves the current bundle (Form C multi-guest,
address line 2, car capture), and an end-to-end foreign check-in with a
companion wrote 2 Form C rows and 2 passport scans **into demovilla-db**, with
zero rows appearing in `bgindia-db`.

## Tenancy: the host is resolved from the hostname (2026-08-25)

`platform_tenants.primary_hostname` had existed unused since the table was
created. It is now populated and wired up: the worker asks the request which
host it belongs to, instead of reading a variable fixed per deployment.

```
resolveTenantByHostname(DB, hostname)   ->  platform_tenants.primary_hostname
const DEFAULT_VILLA_ID = hostVillaId || env.DEFAULT_VILLA_ID || 'dwarka'
```

**Purely additive.** An unmatched hostname falls through to the wrangler.toml
variable exactly as before, so `join.`, `manage.`, the `*.pages.dev` addresses
and the demo deployment are untouched. `dwarka.stayvibe360.com` now resolves
by lookup instead of by default — the same answer, reached differently.

Cached per isolate for five minutes; only hostname → tenant id is cached,
nothing user-specific. A database with no `platform_tenants` table (the demo's)
is caught and falls back rather than taking the API down.

### What this does and does not unlock

It removes the *worker* half of per-host deployment. The worker already looked
its host config up at runtime (`getHostConfig(villaId)`), so with hostname
resolution it can serve many hosts from one deployment.

The **front end is still one build per host** — `VITE_HOST || 'dwarka'` plus
the `@host-config` Vite alias bake branding, pricing and theme into the bundle.
Until that reads its config at runtime, adding `newhost.stayvibe360.com` to the
existing Pages project would serve Dwarka's branding. That is the remaining
work, and it is the larger half.

### assertPropertyAccess is NOT a fail-open bug

Worth recording because it looks like one and I called it one:

```js
if (payload.propertyIds == null) return
```

`propertyIds` is null in exactly two cases — the master-owner PIN (an env
secret) and the `SYSTEM_TOKEN` server-to-server path used by the Apps Script
jobs. Both are deliberate bypasses. Every real tenant login sets a concrete
array from `platform_properties WHERE tenant_id = ?`, even when empty, so there
is no ambiguous in-between state for a tenant token to fall into.

**Do not "harden" this to deny-by-default.** It would lock out master-owner
login and every automated job, and it would not close a gap, because no gap
exists.
