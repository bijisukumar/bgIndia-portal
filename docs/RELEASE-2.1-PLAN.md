# RELEASE 2.1 — Table Namespaces + SaaS Readiness

**Goal:** classify every table by app (`stayvibe_`, `estate360_`, `rev360_`, `infra_`),
centralize all configurables for tenant onboarding, deploy as one release.
**Driver:** first SaaS customers in ~10 days.

## 1. Complete table inventory → new names (48 tables)

Physical split today: villa/rental/infra tables in `bgindia-db` (binding `DB`),
estate tables in `bgindiadb-estates` (binding `DB_ESTATES`). Prefixes make the
classification explicit inside each DB.

### stayvibe_ (villa hospitality — 20 tables, bgindia-db)
| Current | New | Code refs |
|---|---|---|
| stays | stayvibe_stays | 850 |
| bookings | stayvibe_bookings | 113 |
| enquiries | stayvibe_enquiries | 106 |
| raman_commissions | stayvibe_raman_commissions | 289 |
| inventory | stayvibe_inventory | 82 |
| inventory_restock_log | stayvibe_inventory_restock_log | 7 |
| stay_cars | stayvibe_stay_cars | 10 |
| stay_incidentals | stayvibe_stay_incidentals | 17 |
| checkin_links | stayvibe_checkin_links | 9 |
| guest_requests | stayvibe_guest_requests | 15 |
| duplicate_bookings | stayvibe_duplicate_bookings | 14 |
| villa_expenses | stayvibe_villa_expenses | 9 |
| villa_rate_cards | stayvibe_villa_rate_cards | 6 |
| villa_settings | stayvibe_villa_settings | 21 |
| marketing_campaigns | stayvibe_marketing_campaigns | 10 |
| campaign_analytics | stayvibe_campaign_analytics | 8 |
| booking_line_items | stayvibe_booking_line_items | 24 |
| channels | stayvibe_channels | 10 |
| payouts | stayvibe_payouts | 2 |
| payout_map | stayvibe_payout_map | 4 |

### estate360_ (11 tables, bgindiadb-estates)
coconut_harvests, rubber_harvests, rubber_production, estate_transactions,
estate_managers, estate_contacts, manager_settlements, irrigation_logs,
irrigation_zones, mango_harvests, fertilization_log → `estate360_<same>`.
(Refs: 33/26/16/33/8/4/8/28/7/11/5.)

### rev360_ (rental — 10 tables, bgindia-db)
rental_props (108), rent_transactions (75), rental_income (28),
tenancy_history (17), incoming_tenants (22), property_details (27),
property_documents (7), property_expenses (17), hoa_history (6),
tax_history (6) → `rev360_<same>`.

### infra_ (common — 4 tables, bgindia-db)
processing_log (24), deletion_log (5), alert_log (10) → `infra_<same>`.

### ⚠ OWNER DECISION NEEDED (3 tables)
- **guests (407 refs) + guest_documents (32)** — used today only by stayvibe,
  but "guest" is the natural shared identity if estates/rentals ever reference
  people. Proposed: `stayvibe_guests` (rename later is cheap once namespaced).
- **communication_log (10)** — villa comms today → proposed `stayvibe_`.
- **maintenance_events (10)** — verify at execution whether rental or estate
  scoped; classify accordingly.

## 2. What must change (end-to-end impact)

1. **DB:** one rename migration per database (`ALTER TABLE x RENAME TO p_x`).
   SQLite preserves data, indexes, and self-referencing FKs on rename. A
   reverse (rollback) migration is generated alongside.
2. **Worker** `functions/api/[[route]].js` (~5,000 lines): all SQL strings.
   Replacement is **SQL-context-scoped** (FROM/INTO/UPDATE/JOIN/TABLE tokens),
   never a blind find-replace — words like "stays" appear in UI text, comments,
   variable names, and API field names that must NOT change (the API contract
   to screens and Apps Script stays identical).
3. **Schema files:** schema.sql, schema-estates.sql.
4. **Scripts:** every scripts/*.sql (ledger, backfills, migrations, seeds).
5. **Screens:** only the infra suite touches table names directly
   (D1Explorer, SchemaValidation via **schemaContracts.js**, Maintenance).
   All other screens call API actions — zero changes.
6. **Apps Script (.gs):** verified — they call the portal API by action name,
   not SQL. Zero changes.
7. **External habits:** owner's saved D1-console queries will need new names.

## 3. Deploy sequence (one go, with eyes open)

D1 migration and Pages deploy cannot be atomic together → there is an
unavoidable ~2-5 minute window where old code hits new tables. Plan:
1. Branch `release/2.1` with all code changes + both migrations + rollback.
2. Gates before merge: `node --check` worker; vite builds of all 4 apps;
   grep audit proving zero un-prefixed table tokens remain in SQL strings;
   schemaContracts.js updated.
3. **Window (IST night, after Jagadish's Jul-10 check-in settles):**
   run both DB migrations → merge to main → Pages auto-deploys (~2 min).
4. Validate: run **TestRunner** (full suite) + **SchemaValidation** against
   the new contracts. Rollback = reverse migrations + git revert.

## 4. Configuration inventory (SaaS onboarding surface)

### Already centralized — src/config.js ("change this file only" by design)
brandName/brandShort/tagline · appsScriptUrl · driveRootId · ownerEmail ·
spreadsheetId · guestFormSheetId · villas[] (id, name, full, location, active,
logoUrl) · rentalProperties[] (id, name, location, unitNo, floor, building,
city, hasParking, electricityConsumerNo, furnishing) · leaseIndia (lessor
name/address/PAN, bank incl. account/IFSC/SWIFT, renewalIncreasePct 5%,
lateFeeTiers, prematureTermination, defectNoticeDays 10, jurisdiction) ·
estates[] (pollachi/coconut/Pradosh, pavutumuri/rubber/RamananKutty) ·
breakfastRate 275 · additionalGuestRate 750 · dehuskDefaultRate 1.50 · theme.

### Environment (wrangler secrets / bindings)
DB, DB_ESTATES, AI binding · RESEND_API_KEY · auth PINs (env, never code).

### Per-villa data config (DB: villa_settings)
expense_categories (JSON) · activity_ack. Pattern established — extend below.

### ⚠ STRAGGLERS to fold into config for 2.1 (found in code)
- `src/utils/arrivalMessage.js`: VILLA_FULL_NAME, VILLA_ADDRESS,
  VILLA_MAPS_LINK, HOST_WA_NUMBER (+1 972.876.5101), VILLA_BEDROOMS 4,
  check-in "after 4:00 PM" / check-out "by 11:00 AM" → CONFIG.villas[].
- `src/utils/villaPricing.js`: EXTRA_ITEMS labels + default amounts,
  FALLBACK_RATE_CARDS, discount categories/defaults, commission assumptions.
- Rubber defaults: tapping rate 2.75, sheet weight 0.6 kg, sheet ₹200/kg,
  ottupal ₹150/kg → CONFIG.estates[].
- EstateLedger income/expense category lists → config (or estate settings).
- **Hardcoded tenant ids:** `'dwarka'` ×66 in src (26 files) + ×54 worker
  defaults; `'pavutumuri'/'pollachi'` ×23 → replace with CONFIG-derived
  default; worker actions already accept villaId/estate params.

### Onboarding walkthrough (new tenant, target < 1 day)
1. Fill config.js (brand, villas, estates, rentals, lease, rates, theme, logo).
2. Create D1 DBs, run schemas + seeds; set wrangler secrets (PINs, Resend).
3. Google side: Drive root, Sheets IDs, deploy the 3 Apps Script projects,
   point appsScriptUrl.
4. Seed villa_settings (expense_categories, extras when made configurable).
5. Run TestRunner + SchemaValidation as acceptance.

## 5. Test cycle — current answer
- **TestRunner** (/infra): ~16+ live API tests across Infrastructure, Owner
  Flow, Raman Flow, Dashboards, Estate — creates and exercises real records.
- **SchemaValidation** against schemaContracts.js — column-level contract
  checks (must be updated with new table names in this release).
- **D1Explorer / DebugPanel / Maintenance** for inspection.
- No CI/unit tests. Post-2.1 recommendation: a `npm test` API smoke suite
  runnable headless, wired to run before every deploy.
