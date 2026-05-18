# bgIndia Portal — Project Context
> Last updated: May 17 2026 — end of day session
> Paste into Claude Project for full context in every session.

---

## What this is

PWA for managing Guruvayur Estates — villa ops, rental income, two agricultural estates.
React 18 + Vite, Cloudflare Pages. Backend: Cloudflare Workers + D1 (SQLite).
Google Apps Script V21 handles Drive, Gmail, Sheets as parallel layer.

**Live:** https://manage.luxuryvillasofguruvayur.com  
**Repo:** https://github.com/bijisukumar/bgIndia-portal  
**Local:** `C:\Projects\bgIndia-portal` — `git pull origin main` to sync  
**Owner:** bijisukumar@gmail.com

---

## Key IDs

```
Apps Script V21:  https://script.google.com/macros/s/AKfycbzpW7u02Ss_uUkd7539Ja2RrjzanBrIWIfC8b6Q9wCZa7X4xDLjWHnJiRmr7m9VE1DK/exec
Main Spreadsheet: 1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ
Guest Form Sheet: 1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0  (response sheet)
Google Form:      1TUAio85INuDZD-Z1xAeFo3SmV1F5RVezw5xzwrqut-A
Drive Root:       1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva
D1 Database:      bgindia-db  (ID: 6047aa03-9893-4fd9-8ba2-b3d7f5264ed1)
```

**Check-in form document folders (historical DOCX files):**
```
2026: 1IOisLwV7QxihMSRvlalolq1sMtW51QFt
2025: 15fXmazoHTIeUf6Jq9bsaZHzZghzLBcaU
2024: 1HYV_PRNezuHWC9iyL80TTtPuaNqBgJQs
```

**PINs:** Cloudflare env vars: `VITE_PIN_OWNER`, `VITE_PIN_RAMAN`, `VITE_PIN_PRADOSH`

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, React Router v6 |
| Backend | Cloudflare Workers (`functions/api/[[route]].js`) |
| Database | Cloudflare D1 (SQLite) |
| Parallel | Google Apps Script V21 (Drive, Gmail, Sheets backup) |
| Deploy | Cloudflare Pages (auto on push to `main`) |

---

## Properties

**Villa:** `dwarka` — Dwarka GVR Villa, Guruvayur  
Stay IDs: `DWK-YYYY-NNNN`. Channels: Airbnb (3%), Booking.com (15%), Direct (0%), MakeMyTrip (18%)

**Rentals:**
| ID | Name | Location |
|---|---|---|
| `rental_1` | Tritvam | Kochi, KL |
| `rental_2` | Pacifica | OMR, TN |
| `rental_3` | Pinnacle | TCR, KL |

**Estates:** `pollachi` (Coconut, Pradosh), `pavutumuri` (Rubber, Raman)

---

## Roles & Audit

| Role | Who | DB actor | Access |
|---|---|---|---|
| `owner` | Biji | `owner` | Everything |
| `manager` | RamananKutty | `raman` | Villa ops + rubber |
| `estate_manager` | Pradosh | `pradosh` | Pollachi only |
| — | Automated | `auto` | Gmail/Drive pollers |
| — | System | `system` | Seeds, migrations |

Actor set in `sessionStorage.ge_actor` on login → sent as `X-Actor` header → stamped on every DB row.  
Every table has: `created_by`, `created_at`, `updated_by`, `updated_at`.

---

## Stay Lifecycle

```
booked → confirmed → docs_uploaded → ready_for_checkin → checked_in → ready_for_checkout → checked_out → closed
                                                                                                        → cancelled
```

| Status | Who | How |
|---|---|---|
| `booked`/`confirmed` | Owner | NewBooking screen |
| `docs_uploaded` | Auto | GuestFormScript on form submit |
| `ready_for_checkin` | Auto | Drive watcher (OnlineCheckIn-* + ID-* both present) OR Owner in Complete Booking |
| `checked_in` | Raman | CheckIn screen + car photos |
| `ready_for_checkout` | Raman | CheckIn → In-house tab |
| `checked_out` | Raman | CheckIn → Raman commission auto-created |
| `cancelled` | Owner | Complete Booking screen |

---

## Screen Map

```
src/screens/
├── Login.jsx                    PIN entry, sets ge_actor
├── OwnerHome.jsx
├── RamanHome.jsx                Shows ready-for-checkin badge count
├── PradoshHome.jsx
├── RDashboard.jsx               Commission tracker (per-stay checkboxes, quarterly)
├── RDashboardSnapshot.jsx       Raman quick earnings (/raman/dashboard)
│
├── villa/
│   ├── VillaHub.jsx
│   ├── NewBooking.jsx           Date conflict check → 409 on clash
│   ├── CompleteBooking.jsx      /owner/villa/income — lifecycle + financials
│   │                            Extra charges dropdown, Airbnb fee breakdown
│   ├── CheckIn.jsx              Tab 1: ready_for_checkin guests
│   │                            Tab 2: in-house (checked_in, ready_for_checkout)
│   ├── VillaDashboard.jsx
│   ├── KitchenIncidentals.jsx   Locked until checked_in
│   ├── BreakfastEntry.jsx       Locked until checked_in
│   ├── CarRentalEntry.jsx       Locked until checked_in
│   ├── GuestRepository.jsx      Guests tab (channels, stars, city)
│   │                            Marketing tab (city stats, purpose, channel vs revenue, data quality)
│   └── Inventory.jsx
│
├── rental/
│   ├── RentalProperties.jsx     Year selector (current + last year)
│   └── RentalAgreement.jsx      /owner/rental/agreement
│
├── estates/  (CoconutTracker, RubberTracker, EstateLedger etc.)
└── infra/    (D1Explorer, DebugPanel, TestRunner — 16/16 passing)
```

---

## D1 Schema — stays table (key columns)

```sql
stay_id, villa_id, source, guest_name, guest_phone, guest_email,
checkin_date, checkout_date, nights, adults, children,
tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net,
status, drive_folder_id, drive_folder_url,
home_address, city, state, country, from_city, pincode,
govt_id_type,    -- 'Aadhaar' | 'Passport' | 'Other'
govt_id_num,     -- ID number
review_rating,   -- 1-5 (0 = none)
review_source,   -- 'airbnb' | 'google'
review_date, airbnb_conf, converted_to_direct,
created_by, created_at, updated_by, updated_at
```

Other tables: `guest_requests`, `stay_cars`, `stay_incidentals`, `inventory`,
`rental_props` (deposit, agreed_rent, maintenance_fee, lease_start, lease_end),
`rental_income`, `coconut_harvests`, `rubber_harvests`, `raman_commissions`

---

## Worker API (functions/api/[[route]].js)

All app calls → `/api/<action>`. `X-Actor` header on every request.

**GET:** getStays, getActiveStay, getUpcomingStays, getOpenStays, findOpenStay,
getPendingCheckIns (returns `ready_for_checkin`), getVillaDashboard, getGuests,
getMarketingStats, getRamanUnpaid, getRamanHistory, getRamanDashboard,
getRentalIncome, getRentalDashboard, getRentalAgreements, getCoconutHarvests,
getRubberHarvests, getInventory, findStayForReview, runSQL

**POST:** createBooking, confirmCheckIn, checkOut, cancelStay, updateStayStatus,
updateStayLocation, updateDriveFolder, saveVillaRentalIncome, saveKitchenEntry,
saveBreakfastEntry, saveCarRental, saveVillaExpense, saveRentalIncome,
saveRentalAgreement, saveCoconutHarvest, saveRubberHarvest, saveInventoryPrices,
saveInventoryRestock, markRamanPaid (supports `commIds[]`, `quarter`, or all),
saveReview, setReadyForCheckIn, updateStayLocation, updateDriveFolder

---

## Automation Flow

```
Airbnb email → pollGmail (5min) → createBooking in D1 + Sheets + Drive folder
Guest submits form → onGuestFormSubmit (instant) → rename files → updateStayLocation → docs_uploaded
pollDriveCheckIns (10min) → finds OnlineCheckIn-* + ID-* → setReadyForCheckIn → email owner
Raman checks in → checked_in → commission auto-created
Review email → pollGmail → saveReview → shows ★ in Guest Repository
```

**Drive folder structure:** `Guests/YYYY/MM-MonthName/GuestName-DD-StayID/`  
**File naming:** `OnlineCheckIn-StayID-FirstName.ext` and `ID-StayID-FirstName.ext`

---

## Apps Script Setup

**Two scripts:**

1. **Main V21** — time triggers via `setupTriggers()` (already done):
   - `pollGmail` every 5 min
   - `pollDriveCheckIns` every 10 min

2. **GuestFormScript** — bound to form response sheet (`1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0`):
   - Trigger: `onGuestFormSubmit` → From spreadsheet → On form submit (already done)

---

## Scripts Directory

| File | Purpose | Status |
|---|---|---|
| `schema.sql` | Full D1 schema | Done |
| `scripts/migrate-audit-columns.sql` | Add audit cols to all tables | Done May 17 |
| `scripts/migrate-location-columns.sql` | Add city/state/country/pincode/govt_id | **Run if not done** |
| `scripts/migrate-review-columns.sql` | Add review_rating/source/date | Done May 17 |
| `scripts/seed-reviews-5star.sql` | Set all existing stays to 5★ Google | Done May 17 |
| `scripts/rollback-test-data.sql` | Clean test data after TestRunner | Run after testing |
| `scripts/AppsScript-additions.gs` | Append to V20 → V21 | Done |
| `scripts/GuestFormScript.gs` | Bound script on form response sheet | Done |
| `scripts/BackfillLocationData-Standalone.gs` | **v3** — one-time location backfill | **IN PROGRESS** |

---

## Location Backfill — IN PROGRESS (as of May 17 2026)

Parsing 2024/2025/2026 check-in DOCX files to extract city/state/address/ID and backfill D1.

**v1:** 13% — HTML returned instead of DOCX text  
**v2:** 7% — booker name regex captured `"/ Approved Guest:"`, same HTML issue  
**v3 (current):** Fixes: DOCX→Google Doc conversion via `Drive.Files.copy()`, filename-based name fallback, tab-separated address extraction. **Dry run pending.**

**To run v3:**
1. Open standalone Apps Script project
2. Replace code with `scripts/BackfillLocationData-Standalone.gs`
3. Services (+) → Enable **Google Drive API** advanced service
4. Run `runDryRun()` → review email + CSV
5. Run `runBackfill()` → download SQL → `wrangler d1 execute bgindia-db --file=backfill-v3-DATE.sql --remote`
6. Run `cleanupTemp()` to delete temp Google Doc copies

---

## Pricing / Business Rules

- Breakfast: ₹275/person/day
- Floor bed: ₹750/night
- **Raman commission:** 1 night = ₹1,000 · 2+ nights = ₹2,000 (edit only in `calcCommission()` in Worker + RDashboard.jsx)
- Auto-created in `raman_commissions` at `checked_out` (not at booking)

---

## Pending Items

- [ ] Location backfill v3 dry run + SQL run
- [ ] `closed` status — no UI button yet (financials settlement step)
- [ ] Rubber tracker redesign (match CoconutTracker detail level)
- [ ] Owner financial summary dashboard
- [ ] Govt ID numbers stored plain text — consider masking (last 4 only)
- [ ] Drive folder creation from Worker (needs OAuth — currently Apps Script only)
- [ ] Airbnb email parser tuning after real emails received
- [ ] Multi-tenant SaaS layer

---

## Dev Commands

```bash
npm run dev                    # http://localhost:5173
git pull origin main           # sync latest
git add . && git commit -m "msg" && git push   # deploy (Cloudflare auto-deploys ~30s)

wrangler d1 execute bgindia-db --file=scripts/migrate-location-columns.sql --remote
wrangler d1 execute bgindia-db --remote --command "SELECT COUNT(*) FROM stays"
wrangler d1 execute bgindia-db --file=scripts/rollback-test-data.sql --remote
```

---

## Check-in DOCX Structure (for parsing reference)

```
"Booked By/Approved Guest: Sangeeth"   ← booker name (colon optional, may have no space)
"Booking Partner: Airbnb"              ← channel
"Check-in: May 12th 2026"             ← date
"Adhar/Passport Number: X9171135"     ← govt ID
"Email: guest@email.com"
"Phone: +91 XXXXXXXXXX"
Guest table row 1 (tab-separated when exported):
  "1  \t  GuestName/Age  \t  Full Home Address"
```

Aadhaar PDF address block: `"Address: #188 Adarsh Palm Meadows, Whitefield, Bangalore..."`
