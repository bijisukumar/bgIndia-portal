# bgIndia Portal — Project Context
> Last updated: May 17 2026 — comprehensive update after major build session
> Paste this file into a Claude Project so every session starts with full context.

---

## What this is

A Progressive Web App (PWA) for managing Guruvayur Estates properties — villa operations, passive rental income, and two agricultural estates. Built with React 18 + Vite, deployed on Cloudflare Pages. Backend is Cloudflare Workers + D1 (SQLite), with Google Apps Script V21 handling Drive, Gmail, and Sheets as a parallel layer.

**Live URL:** https://manage.luxuryvillasofguruvayur.com  
**GitHub repo:** https://github.com/bijisukumar/bgIndia-portal  
**Local clone (Windows):** `C:\Projects\bgIndia-portal` — run `git pull origin main` to get latest  
**Owner email:** bijisukumar@gmail.com

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router v6 |
| PWA | vite-plugin-pwa (installable on Android) |
| Styling | Custom CSS variables, dark theme, gold accent (`--gold: #C8903A`) |
| Backend | Cloudflare Workers (functions/api/[[route]].js) |
| Database | Cloudflare D1 (SQLite) — database name: `bgindia-db` |
| Parallel backend | Google Apps Script V21 (Sheets, Drive, Gmail) |
| File storage | Google Drive (per-stay folders, Year/Month/Guest-DD-StayID structure) |
| Deployment | Cloudflare Pages (auto-deploys on every push to `main`) |

---

## Key IDs & Config

```
Apps Script URL (V21): https://script.google.com/macros/s/AKfycbzpW7u02Ss_uUkd7539Ja2RrjzanBrIWIfC8b6Q9wCZa7X4xDLjWHnJiRmr7m9VE1DK/exec
Spreadsheet ID:        1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ
Guest Form Sheet ID:   1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0
Google Form ID:        1TUAio85INuDZD-Z1xAeFo3SmV1F5RVezw5xzwrqut-A
Google Drive Root:     1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva
D1 Database ID:        6047aa03-9893-4fd9-8ba2-b3d7f5264ed1
```

**Google Drive folder structure:**
```
BG-India/Portal/Guests/
  └── YYYY/
      └── MM-MonthName/           e.g. 05-May
          └── GuestName-DD-StayID/  e.g. Vikram Ramasubramanian-08-DWK-AB123
              ├── OnlineCheckIn-StayID-FirstName.pdf
              └── ID-StayID-FirstName.pdf (Aadhaar or Passport)
```

**Check-in form document folders (historical):**
```
2026: https://drive.google.com/drive/folders/1IOisLwV7QxihMSRvlalolq1sMtW51QFt
2025: https://drive.google.com/drive/folders/15fXmazoHTIeUf6Jq9bsaZHzZghzLBcaU
2024: https://drive.google.com/drive/folders/1HYV_PRNezuHWC9iyL80TTtPuaNqBgJQs
Parent (2024+2025 combined): https://drive.google.com/drive/folders/1AKfO9T3_dusEalco9wF-aXaMghSpuzc8
LVG Guest-Checkin root: https://drive.google.com/drive/folders/1gVeErcRayCUVkeODMJMhJN0a019ikIXv
```

**Check-in DOCX structure (inside each guest folder):**
```
GuestName-LVGGuestCheckIn.docx contains:
  - "Booked By/Approved Guest: Name"   ← booker name
  - "Booking Partner: Airbnb/Direct"   ← channel
  - "Check-in: May 12th"               ← dates
  - "Adhar/Passport Number: X9171135"  ← govt ID
  - "Email: guest@email.com"
  - "Phone: +91 XXXXXXXXXX"
  - Guest table: row 1 has full home address
  - Purpose of Visit
```

**PINs** — stored as Cloudflare environment variables (never in code):
- `VITE_PIN_OWNER` — Biji (owner)
- `VITE_PIN_RAMAN` — RamananKutty (villa manager)
- `VITE_PIN_PRADOSH` — Pradosh (estate manager)

For local dev: create `.env.local` in repo root (gitignored).

---

## Properties

### Villa
| ID | Name | Location | Status |
|---|---|---|---|
| `dwarka` | Dwarka — GVR Villa | Guruvayur, Kerala | Active |

Stay IDs: `DWK-YYYY-NNNN` (e.g. `DWK-2026-0042`)  
Booking channels: Airbnb (3% host fee), Booking.com (15%), Direct (0%), MakeMyTrip (18%), Goibibo (18%)

**Pricing defaults (in config.js):**
- Breakfast: ₹275/person/day
- Floor bed (additional guest): ₹750/night
- Raman commission: ₹1,000 (1 night), ₹2,000 (2+ nights)

**Extra charge items (CompleteBooking screen dropdown):**
Early Check-in, Late Check-out, Early Check-in + Late Check-out, Breakfast, Floor Bed, Taxi Pick-up, Drop-off & Pick-up, Cleaning Fee, Other

### Rental Properties
| ID | Name | Location |
|---|---|---|
| `rental_1` | Tritvam | Kochi, KL |
| `rental_2` | Pacifica | OMR, TN |
| `rental_3` | Pinnacle | TCR, KL |

Monthly fields: rent, maintenance, electricity, water, property_tax, land_tax, car_parking, extra_maintenance  
Tenant agreement screen: `/owner/rental/agreement` — captures deposit, agreed_rent, maintenance_fee, lease_start, lease_end, notes  
Year selector on monthly entry: current year + last year

### Estates
| ID | Type | Manager |
|---|---|---|
| `pollachi` | Coconut (harvest every ~45 days) | Pradosh |
| `pavutumuri` | Rubber | RamananKutty |

---

## User Roles & Actor Values

| Role | Who | PIN var | DB actor value | Access |
|---|---|---|---|---|
| `owner` | Biji | `VITE_PIN_OWNER` | `owner` | Everything |
| `manager` | RamananKutty | `VITE_PIN_RAMAN` | `raman` | Villa ops, rubber estate |
| `estate_manager` | Pradosh | `VITE_PIN_PRADOSH` | `pradosh` | Pollachi estate only |
| — | Automated/AI | — | `auto` | Gmail poller, Drive watcher |
| — | System | — | `system` | Seed scripts, migrations, commission auto-create |

Actor stored in `sessionStorage.ge_actor` on login, sent as `X-Actor` header on every API call.  
Every DB row has `created_by`, `updated_by`, `created_at`, `updated_at` audit columns.  
Goal: 80% of records should eventually show `auto` as automation matures.

---

## Stay Lifecycle

```
booked → confirmed → docs_uploaded → ready_for_checkin → checked_in → ready_for_checkout → checked_out → closed
                                                                                                         → cancelled
```

| Status | Who sets it | How |
|---|---|---|
| `booked` | Owner | NewBooking screen (default) |
| `confirmed` | Owner | NewBooking screen |
| `docs_uploaded` | Auto / Owner | GuestFormScript triggers on form submit OR Complete Booking screen |
| `ready_for_checkin` | Auto / Owner | Drive watcher detects OnlineCheckIn-* + ID-* files OR Complete Booking button |
| `checked_in` | Raman | CheckIn screen → car photos + confirm |
| `ready_for_checkout` | Raman | CheckIn → In-house tab |
| `checked_out` | Raman | CheckIn → In-house tab → Raman commission auto-created |
| `closed` | Owner | (not yet wired to UI) |
| `cancelled` | Owner | Complete Booking screen |

---

## Screen Map (current)

```
src/screens/
├── Login.jsx                        — PIN entry, role-based redirect, sets ge_actor
├── OwnerHome.jsx                    — Hospitality | Estates sections
├── PradoshHome.jsx                  — Pollachi estate hub
├── RamanHome.jsx                    — Villa ops hub (shows ready-for-checkin count badge)
├── RDashboard.jsx                   — Raman commission tracker (checkboxes, quarterly)
├── RDashboardSnapshot.jsx           — Raman quick earnings snapshot (/raman/dashboard)
│
├── villa/
│   ├── VillaHub.jsx                 — Multi-villa selector
│   ├── NewBooking.jsx               — Creates StayID, date conflict check, Drive folder
│   ├── CompleteBooking.jsx          — Was VillaRentalIncome; lifecycle mgmt + financials
│   │                                  Route: /owner/villa/income
│   │                                  Extra charges dropdown, Airbnb fee breakdown
│   ├── VillaDashboard.jsx           — Revenue/expense/net dashboard
│   ├── CheckIn.jsx                  — Raman: check-in tab (ready_for_checkin) +
│   │                                  in-house tab (checked_in, ready_for_checkout)
│   ├── KitchenIncidentals.jsx       — Checkout billing (locked until guest checked_in)
│   ├── BreakfastEntry.jsx           — Breakfast tracking (locked until checked_in)
│   ├── CarRentalEntry.jsx           — Car rental/cab income (locked until checked_in)
│   ├── GuestRepository.jsx          — Guest list + Marketing tab
│   │                                  Guests tab: channel badges, city, star ratings
│   │                                  Marketing tab: city stats, purpose breakdown,
│   │                                  channel vs revenue chart, data quality report
│   └── Inventory.jsx                — Stock levels, pricing, restock log
│
├── rental/
│   ├── RentalProperties.jsx         — Monthly entry (year selector) + Dashboard + Agreements tab
│   └── RentalAgreement.jsx          — Tenant agreement screen (/owner/rental/agreement)
│
├── estates/
│   ├── PollachiHub.jsx
│   ├── CoconutTracker.jsx
│   ├── CoconutDashboard.jsx
│   ├── PavutumuriHub.jsx
│   ├── RubberTracker.jsx
│   └── EstateLedger.jsx
│
└── infra/
    ├── D1Explorer.jsx               — SQL query interface
    ├── DebugPanel.jsx               — API connectivity test
    └── TestRunner.jsx               — 16 automated tests (all passing as of May 17 2026)
```

---

## Database Schema (Cloudflare D1)

**All tables have audit columns:** `created_by`, `created_at`, `updated_by`, `updated_at`

### stays (primary table)
```sql
stay_id, villa_id, source, guest_name, guest_phone, guest_email,
checkin_date, checkout_date, nights, adults, children,
tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net,
status,           -- lifecycle status (see above)
drive_folder_id,  -- Drive folder ID
drive_folder_url, -- full Drive URL
home_address,     -- full home address from check-in form
city,             -- parsed city
state,            -- parsed state
country,          -- parsed country (default 'India')
from_city,        -- short city name for display
pincode,          -- 6-digit Indian postal code
govt_id_type,     -- 'Aadhaar' | 'Passport' | 'Other'
govt_id_num,      -- ID number
review_rating,    -- 1-5 stars (0 = no review)
review_source,    -- 'airbnb' | 'google'
review_date,      -- YYYY-MM-DD
airbnb_conf,      -- Airbnb confirmation code
converted_to_direct,
created_by, created_at, updated_by, updated_at
```

### Other tables
| Table | Purpose |
|---|---|
| `guest_requests` | Breakfast / floor-bed / car rental / villa expense per stay |
| `stay_cars` | Check-in car photos (plate + Drive URL) |
| `stay_incidentals` | Kitchen checkout billing lines |
| `inventory` | Per-villa stock, cost price, sell price |
| `rental_props` | Rental property master + tenant lease details (deposit, agreed_rent, maintenance_fee, lease_start, lease_end) |
| `rental_income` | Monthly income/expense per property |
| `coconut_harvests` | Full harvest: 4-block earnings, 4-block expenses, payments |
| `rubber_harvests` | Rubber estate harvests |
| `raman_commissions` | Commission per stay (comm_id, stay_id, is_paid, paid_date) |

### Key SQL patterns
```sql
-- Upcoming stays for Complete Booking screen
SELECT * FROM stays
WHERE status NOT IN ('closed','cancelled','checked_out')
  AND (checkin_date >= date('now', '-2 days') OR status IN ('checked_in','ready_for_checkout','ready_for_checkin'))
ORDER BY checkin_date ASC;

-- Raman commission owed
SELECT guest_name, checkin_date, nights, commission, comm_id
FROM raman_commissions WHERE is_paid = 0 ORDER BY checkin_date;

-- City breakdown for marketing
SELECT from_city, state, COUNT(DISTINCT guest_name) guests, COUNT(*) bookings
FROM stays WHERE status NOT IN ('cancelled')
GROUP BY from_city ORDER BY guests DESC;

-- Data quality check
SELECT COUNT(*) total,
  SUM(CASE WHEN from_city IS NULL OR from_city='' THEN 1 ELSE 0 END) missing_city,
  SUM(CASE WHEN guest_email IS NULL OR guest_email='' THEN 1 ELSE 0 END) missing_email
FROM stays WHERE status NOT IN ('cancelled');
```

---

## API Layer (src/api/index.js)

All calls go to `/api/<action>` via Cloudflare Worker.  
Every request sends `X-Actor: <role>` header for audit trail.

**Key methods:**
```
createBooking, confirmCheckIn, getActiveStay, getUpcomingStays
checkOut, cancelStay, updateStayStatus, updateStayLocation, updateDriveFolder
saveVillaRentalIncome, saveKitchenEntry, saveBreakfastEntry, saveCarRental, saveVillaExpense
saveRentalIncome, getRentalIncome, getRentalDashboard
getRentalAgreements, saveRentalAgreement
saveCoconutHarvest, getCoconutHarvests
saveRubberHarvest, getRubberHarvests
saveInventoryPrices, getInventoryPrices, saveInventoryRestock, getInventory
getVillaDashboard, getStays, getGuests, getMarketingStats
getRamanUnpaid, getRamanHistory, markRamanPaid, getRamanDashboard
findStayForReview, saveReview, setReadyForCheckIn
getOpenStays, findOpenStay
runSQL (D1Explorer)
```

---

## Worker Endpoints (functions/api/[[route]].js)

**GET endpoints:** getStays, getActiveStay, getUpcomingStays, getOpenStays, findOpenStay,
getPendingCheckIns (returns ready_for_checkin status), getVillaDashboard, getGuests,
getMarketingStats, getRamanUnpaid, getRamanHistory, getRamanDashboard, getRentalIncome,
getRentalDashboard, getRentalAgreements, getCoconutHarvests, getRubberHarvests,
getInventory, findStayForReview

**POST endpoints:** createBooking (with date conflict check → 409), confirmCheckIn,
checkOut, cancelStay, updateStayStatus, updateStayLocation, updateDriveFolder,
saveVillaRentalIncome, saveKitchenEntry, saveBreakfastEntry, saveCarRental,
saveVillaExpense, saveRentalIncome, saveRentalAgreement, saveCoconutHarvest,
saveRubberHarvest, saveInventoryPrices, saveInventoryRestock, markRamanPaid,
saveReview, setReadyForCheckIn, runSQL

**Commission logic (in Worker — not shown in UI):**
- 1-night stay → ₹1,000
- 2+ nights → ₹2,000
- Auto-created in `raman_commissions` table when stay moves to `checked_out`
- `markRamanPaid` supports: specific `commIds[]` array, `quarter` string, or all unpaid

---

## Google Apps Script (V21)

**Two script files:**

### Main Script (V21) — append `scripts/AppsScript-additions.gs` to bottom of V20
Contains: `getOrCreateGuestFolder`, `onGuestFormSubmit` (disabled — use GuestFormScript instead),
`pollGmail`, `pollAirbnbBookings`, `pollAirbnbReviews`, `pollGoogleReviews`,
`pollDriveCheckIns`, `callWorker`, `setupTriggers`, `markOldReviewEmailsRead`

**Active triggers (set via `setupTriggers()`):**
- `pollGmail` — every 5 minutes (Airbnb bookings + reviews)
- `pollDriveCheckIns` — every 10 minutes (detects OnlineCheckIn-* + ID-* files)

### Guest Form Script — separate bound script on the form response spreadsheet
File: `scripts/GuestFormScript.gs`  
Spreadsheet: `1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0`  
Trigger: `onGuestFormSubmit` → From spreadsheet → On form submit

**What GuestFormScript does:**
1. Reads latest form response (booker name, check-in date, address, ID, email, phone)
2. Calls Worker `findOpenStay` to match to open booking
3. Renames uploaded files: `OnlineCheckIn-StayID-FirstName.ext` and `ID-StayID-FirstName.ext`
4. Moves files into correct Drive folder (Year/Month/Guest-DD-StayID)
5. Calls Worker `updateStayLocation` to save address, city, state, country, pincode, phone, email
6. Calls Worker `updateStayStatus` → `docs_uploaded`
7. Emails owner summary

**Gmail review polling (30-day filter applied):**
- Airbnb: `from:automated@airbnb.com subject:"left a" subject:"review" is:unread`
- Google: `subject:"left a review for Dvaraka" is:unread`
- Matches to stay by guest name + checkout within 14 days
- Saves rating to D1 `stays.review_rating`

---

## Automation Flow (end-to-end)

```
Airbnb confirmation email arrives
  → pollGmail (every 5 min) parses: guest, dates, night fee, cleaning fee, host fee, you earn, guest paid
  → createBooking in D1 (status: confirmed) + Sheets backup
  → getOrCreateGuestFolder creates: Guests/2026/05-May/GuestName-08-DWK-XXXXX
  → Owner email with all fee details

Guest submits check-in form (form URL sent by owner)
  → onGuestFormSubmit fires instantly
  → Matches to open stay by name + check-in date
  → Renames + moves: OnlineCheckIn-StayID-* and ID-StayID-* into guest Drive folder
  → updateStayLocation: saves city/state/country/pincode/phone/email to D1
  → updateStayStatus → docs_uploaded
  → Owner email with guest details + ETA + purpose

pollDriveCheckIns (every 10 min) checks only open stay folders
  → Finds both OnlineCheckIn-* and ID-* files
  → setReadyForCheckIn → status = ready_for_checkin
  → Owner email, Raman sees guest on Check-in screen

Raman checks in guest (car photos + confirm)
  → confirmCheckIn → checked_in
  → Raman commission auto-created in raman_commissions

Guest checks out
  → checkOut → checked_out
  → Raman commission confirmed

Airbnb/Google review email arrives
  → pollGmail matches to stay (checkout within 14 days)
  → saveReview → stays.review_rating, review_source
  → Shows as ★★★★★ AB/G on Guest Repository
```

---

## Scripts Directory

| File | Purpose | Run once? |
|---|---|---|
| `schema.sql` | Full D1 schema | Yes (initial setup) |
| `scripts/seed-airbnb.sql` | 153 Airbnb bookings 2018-2026 | Yes |
| `scripts/seed-master.sql` | 87 Direct/Booking.com bookings | Yes |
| `scripts/seed-reviews-5star.sql` | Bulk set all existing stays to 5★ Google | Yes (done May 17 2026) |
| `scripts/migrate-audit-columns.sql` | Add created_by/updated_by to all tables | Yes (done May 17 2026) |
| `scripts/migrate-location-columns.sql` | Add city/state/country/pincode/govt_id to stays | Run if not done |
| `scripts/migrate-review-columns.sql` | Add review_rating/source/date + drive_folder_url | Yes (done May 17 2026) |
| `scripts/rollback-test-data.sql` | Clean up test data after TestRunner | After each test run |
| `scripts/AppsScript-additions.gs` | Append to bottom of V20 Apps Script → V21 | Done |
| `scripts/GuestFormScript.gs` | Bound script for form response spreadsheet | Done |
| `scripts/BackfillLocationData-Standalone.gs` | One-time: parse historical check-in docs → SQL | Run dry run first |

**Backfill script usage:**
1. Create new Apps Script project at https://script.google.com
2. Paste `scripts/BackfillLocationData-Standalone.gs` (fully self-contained)
3. Run `runDryRun()` → review validation CSV + email report (coverage %, unmatched list)
4. Run `runBackfill()` → generates SQL file in Drive
5. `wrangler d1 execute bgindia-db --file=backfill-location-YYYY-MM-DD.sql --remote`

---

## Development Commands

```bash
# Local dev
npm run dev          # http://localhost:5173
npm run build
npm run preview

# D1 operations
wrangler d1 execute bgindia-db --file=schema.sql --remote
wrangler d1 execute bgindia-db --file=scripts/migrate-location-columns.sql --remote
wrangler d1 execute bgindia-db --remote --command "SELECT COUNT(*) FROM stays"
wrangler d1 execute bgindia-db --file=scripts/rollback-test-data.sql --remote

# Deploy
git pull origin main          # get latest from GitHub
git add . && git commit -m "message" && git push
# Cloudflare auto-deploys in ~30 seconds
```

---

## Key Architectural Decisions

- **D1 as primary database** — Cloudflare D1 (SQLite) is the source of truth. Apps Script/Sheets is a backup layer.
- **Worker as API** — All app calls go to `/api/<action>` via Cloudflare Worker, not directly to Apps Script
- **Actor/audit on every row** — `created_by`/`updated_by` on all 10 tables; sent via `X-Actor` header
- **Apps Script for Google services** — Drive folder creation, Gmail parsing, and Sheets backup all live in Apps Script since Worker cannot access Google APIs
- **Self-contained one-off scripts** — one-time utilities (backfill, migrations) are separate Apps Script projects, not added to V20/V21
- **Double-booking check** — `createBooking` checks for date overlaps before INSERT, returns 409 with conflicting stay details
- **Commission at checkout** — Raman commission created when stay moves to `checked_out`, not at booking, to avoid records for cancelled stays
- **Drive file naming convention** — `OnlineCheckIn-StayID-FirstName.ext` and `ID-StayID-FirstName.ext` — Drive watcher matches on these prefixes
- **Review matching window** — 14 days from checkout date
- **StayID as FK** — all downstream records (incidentals, cars, requests, commissions) reference `stay_id`
- **All currency INR throughout**

---

## Rental Properties — Real Names & Context

| ID | Name | Full Name | Location |
|---|---|---|---|
| `rental_1` | Tritvam | Tritvam | Kochi, KL |
| `rental_2` | Pacifica | Pacifica | OMR (Old Mahabalipuram Road), TN |
| `rental_3` | Pinnacle | Pinnacle | TCR (Thrissur), KL |

---

## Known Issues / Pending Items

- [ ] Historical stays missing city/state/country — run BackfillLocationData-Standalone.gs (dry run in progress as of May 17 2026)
- [ ] `closed` status not yet wired to any UI button (financials settlement step)
- [ ] Rubber tracker — redesign to match CoconutTracker detail level
- [ ] Rental income bulk save (multi-month range)
- [ ] Owner financial summary dashboard (not shown to Raman)
- [ ] Multi-tenant SaaS layer (tenant_id on all tables)
- [ ] Airbnb confirmation email parser may need tuning after real emails tested
- [ ] Govt ID numbers stored in plain text — consider masking (show last 4 digits only)
- [ ] Drive folder for NewBooking created by Apps Script — Worker doesn't create it directly (Google Drive API not available in Cloudflare Workers without OAuth)
