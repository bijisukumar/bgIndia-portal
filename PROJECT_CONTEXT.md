# bgIndia Portal — Project Context
> Paste this file into a Claude Project so every session starts with full context.
> Last updated: May 2026

---

## What this is

A Progressive Web App (PWA) for managing Guruvayur Estates properties — villa operations, passive rental income, and two agricultural estates. Built with React 18 + Vite, deployed on Cloudflare Pages. Currently backed by Google Apps Script + Google Sheets; migrating to Cloudflare D1 (SQLite).

**Live URL:** Cloudflare Pages (auto-deploys on every push to `main`)  
**GitHub repo:** https://github.com/bijisukumar/bgIndia-portal  
**Local clone (Windows):** `C:\Projects\bgIndia-portal` — already cloned, run `git pull` to get latest  
**Owner email:** bijisukumar@gmail.com

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router v6 |
| PWA | vite-plugin-pwa (installable on Android) |
| Styling | Custom CSS variables, dark theme, gold accent |
| Current backend | Google Apps Script (deployed as web app) |
| Target backend | Cloudflare Workers + D1 (SQLite) |
| File storage | Google Drive (per-stay folders) |
| Deployment | Cloudflare Pages |

---

## Key IDs & Config

```
Apps Script URL:    https://script.google.com/macros/s/AKfycbxvidJkt9yOGgMc7bN2ILDVZ1aoGq7EGzVcp472h1dAujBnzDhSql6Ki6UEzSIasJ4R/exec
Spreadsheet ID:     1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ
Guest Form Sheet:   1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0
Google Drive Root:  1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva
```

**PINs** — stored as Cloudflare environment variables (never in code):
- `VITE_PIN_OWNER` — owner PIN
- `VITE_PIN_RAMAN` — RamananKutty (villa manager)
- `VITE_PIN_PRADOSH` — Pradosh (estate manager)

For local dev: create `src/.env.local` (gitignored) with those three vars.

---

## Properties

### Villa
| ID | Name | Location | Status |
|---|---|---|---|
| `dwarka` | Dwarka — GVR Villa | Guruvayur | Active |

Stay IDs follow pattern: `DWK-YYYY-NNNN` (e.g. `DWK-2026-0042`)  
Per-villa logo: set `logoUrl` in `CONFIG.villas[]` for white-labeling.  
Booking channels: Airbnb (3% host fee), Booking.com (15%), Direct (0%).  
Airbnb commission is called "service fee" in their CSV exports.

**Pricing defaults:**
- Breakfast: ₹275/person/day
- Additional guest: ₹750/night
- Raman commission: ₹1,000 (1 night), ₹2,000 (2+ nights)

### Rental Properties (passive income)
3 properties tracked monthly (rent, maintenance, electricity, water, property tax, land tax, car parking, extra maintenance). Add `leaseEnd: "YYYY-MM-DD"` and `tenantName` in `config.js` to enable 60-day renewal alerts.

| ID | Name |
|---|---|
| `rental_1` | Property A |
| `rental_2` | Property B |
| `rental_3` | Property C |

### Estates
| ID | Type | Manager |
|---|---|---|
| `pollachi` | Coconut (harvest every ~45 days) | Pradosh |
| `pavutumuri` | Rubber | RamananKutty |

---

## User Roles

| Role | Who | Access |
|---|---|---|
| `owner` | Biji | Everything — all screens |
| `manager` | RamananKutty | Villa ops: check-in, kitchen incidentals, breakfast, car rental, Pavutumuri rubber |
| `estate_manager` | Pradosh | Pollachi only: coconut tracker, dashboard, ledger |

---

## Screen Map

```
src/screens/
├── Login.jsx                     — PIN entry, role-based redirect
├── OwnerHome.jsx                 — Two sections: Hospitality | Estates
├── PradoshHome.jsx               — Pollachi estate hub
├── RamanHome.jsx                 — Villa ops hub
├── RDashboard.jsx                — RamananKutty commission tracker
│
├── villa/
│   ├── VillaHub.jsx              — Multi-villa selector, SaaS-ready
│   ├── NewBooking.jsx            — Creates StayID, Drive folder
│   ├── VillaRentalIncome.jsx     — Per-booking income record
│   ├── VillaDashboard.jsx        — Revenue/expense/net dashboard
│   ├── CheckIn.jsx               — Guest details, car photo capture
│   ├── KitchenIncidentals.jsx    — Checkout billing (pulls prices from Inventory)
│   ├── BreakfastEntry.jsx        — Breakfast tracking
│   ├── CarRentalEntry.jsx        — Car rental/cab income
│   ├── GuestRepository.jsx       — Guest contact list
│   └── Inventory.jsx             — Stock levels, pricing, restock log
│
├── rental/
│   └── RentalProperties.jsx      — Monthly entry + Dashboard tab + renewal alerts
│
├── estates/
│   ├── PollachiHub.jsx           — Coconut estate menu
│   ├── CoconutTracker.jsx        — Full harvest entry (4-block earnings, expenses, payments)
│   ├── CoconutDashboard.jsx      — Bar chart trend + year-sorted history
│   ├── PavutumuriHub.jsx         — Rubber estate menu
│   ├── RubberTracker.jsx         — Rubber harvest entry
│   └── EstateLedger.jsx          — Estate income/expense ledger
│
└── infra/
    ├── D1Explorer.jsx            — D1 setup guide, schema viewer, SQL query reference
    ├── DebugPanel.jsx            — API connectivity test
    └── TestRunner.jsx            — Automated screen tests
```

**Route access:** Owner → `/infra/d1` (🗄 button on home), Debug 🔧, Test 🧪

---

## Stay Lifecycle (StayID)

```
enquiry → confirmed → checked_in → checked_out → closed
                                               → cancelled
                              (track: converted_to_direct)
```

StayID created at `NewBooking`. Drive folder auto-created. All downstream records (car photos, guest requests, incidentals) reference `stay_id` as FK.

**Airbnb email trigger (planned):** Gmail Apps Script polls every 5 min, parses confirmation email, auto-creates stay with `source=airbnb`, sends owner deep-link notification.

---

## Database — Cloudflare D1

**Schema file:** `schema.sql` (repo root)  
**D1 database name:** `bgindia-db` (to be created)

### Tables
| Table | Purpose |
|---|---|
| `stays` | StayID lifecycle, all booking financials |
| `guest_requests` | Breakfast/floor-bed/car/decor per stay |
| `stay_cars` | Check-in car photos (plate + Drive URL) |
| `stay_incidentals` | Kitchen checkout billing lines |
| `inventory` | Per-villa stock, cost price, sell price |
| `rental_props` | Rental property master + lease dates |
| `rental_income` | Monthly income/expense per property |
| `coconut_harvests` | Full harvest: 4-block earnings, 4-block expenses, payments |
| `rubber_harvests` | Rubber estate harvests |

### Seed Scripts (in `/scripts/`)
- `seed-airbnb.sql` — 153 Airbnb bookings, 2018–2026
- `seed-master.sql` — 87 Direct/Booking.com bookings from master Excel

### Key SQL patterns (SQLite)
```sql
-- All active bookings
SELECT * FROM stays WHERE status IN ('confirmed','checked_in') ORDER BY checkin_date;

-- Airbnb vs Direct revenue split
SELECT source, COUNT(*) bookings, SUM(net) total_net FROM stays
WHERE status != 'cancelled' GROUP BY source;

-- Raman commission owed
SELECT guest_name, checkin_date, nights,
  CASE WHEN nights > 1 THEN 2000 ELSE 1000 END raman_comm
FROM stays WHERE status = 'checked_out';

-- Coconut harvest trend
SELECT strftime('%Y', harvest_date) year, COUNT(*) harvests,
  SUM(net_income) net FROM coconut_harvests GROUP BY year ORDER BY year DESC;
```

---

## Inventory — Default Items (qty=10 each)

| Item | Category | Cost | Sell |
|---|---|---|---|
| Water bottles | Kitchen | ₹18 | ₹30 |
| Soft drinks | Kitchen | ₹40 | ₹60 |
| Chocolates | Kitchen | ₹45 | ₹70 |
| Chips | Kitchen | ₹30 | ₹50 |
| Milk packets | Kitchen | ₹30 | ₹45 |
| Tea/Coffee | Kitchen | ₹15 | ₹25 |
| Eggs | Kitchen | ₹8 | ₹12 |
| Bread | Kitchen | ₹35 | ₹45 |
| Shampoo | Bathroom | ₹80 | — |
| Body wash | Bathroom | ₹90 | — |
| Bathroom cleaner | Bathroom | ₹60 | — |
| Tissue/toilet paper | Bathroom | ₹25 | — |
| Bedroom essentials | Bedroom | — | — |

Kitchen items are billable at checkout. Bathroom/bedroom are cost-tracking only.

---

## Coconut Tracker — Field Logic

**Earnings:**
- [1] Main = `total_weight_kg × price_per_kg`
- [2] Rejection revenue = overridable field (flag if nuts_rejected > 0 but ₹0 entered)
- [3] Husk = `husk_count_sold × husk_cost_per_nut`
- [4] Other = free entry
- Total = [1]+[2]+[3]+[4]

**Expenses:**
- [1] Harvest = `harvest_nuts × harvest_cost_per_nut`
- [2] Dehusk = `dehusk_nuts × dehusk_cost_per_nut` (default ₹1.50/nut)
- [3] Tractor
- [4] Other

**Flags:** rejection % > 2% → warning. No rejection revenue when rejections > 0 → warning.  
**Next harvest:** `harvest_date + 45 days` (shown on form, included in email).  
**Payments:** advance + 2nd payment + final settlement; balance_due = net_income − payments_made.

---

## API Layer (`src/api/index.js`)

All calls go through Apps Script URL as GET (query params) or POST (URL-encoded form).
No `Content-Type: application/json` header — required for CORS with Apps Script.

Key methods:
```
createBooking, confirmCheckIn, getActiveStay
saveVillaRentalIncome, saveKitchenEntry, saveBreakfastEntry, saveCarRental
saveRentalIncome, getRentalIncome, getRentalDashboard
saveCoconutHarvest, getCoconutHarvests
saveRubberHarvest, getRubberHarvests
saveInventoryPrices, getInventoryPrices, saveInventoryRestock, getInventory
getVillaDashboard, getStays, getGuests
getRamanUnpaid, getRamanHistory, markRamanPaid
```

---

## Development Commands

```bash
# Local dev (run from repo root: C:\Projects\bgIndia-portal)
npm run dev          # starts at http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview prod build locally

# D1 Database (after wrangler setup)
wrangler d1 create bgindia-db                          # one-time: create DB
wrangler d1 execute bgindia-db --file=schema.sql --remote   # run schema
wrangler d1 execute bgindia-db --file=scripts/seed-airbnb.sql --remote
wrangler d1 execute bgindia-db --file=scripts/seed-master.sql --remote
wrangler d1 execute bgindia-db --remote --command "SELECT COUNT(*) FROM stays"

# Deploy
git add . && git commit -m "message" && git push
# Cloudflare auto-deploys in ~30 seconds
```

---

## Planned / Not Yet Built

- [ ] Airbnb email → auto-trigger new booking (Gmail Apps Script poller)
- [ ] Rental income bulk save (select month range, save once for 3–6 months)
- [ ] Owner manager dashboard (financial summary, not shown to Raman)
- [ ] Inventory screen linked to Cloudflare Workers (currently frontend-only state)
- [ ] Cloudflare Workers backend to replace Google Apps Script (Phase 2)
- [ ] Multi-tenant SaaS layer (tenant_id on all tables, per-tenant logo/branding)
- [ ] Onboarding screen for new villas/operators
- [ ] Google Drive auto-folder creation per StayID (currently in Apps Script)
- [ ] Rubber tracker — full redesign matching coconut tracker detail level
- [ ] RentalProperties — multi-month bulk entry UI

---

## Key Decisions Made

- **Villa + Rental Income** grouped together as "Hospitality" on OwnerHome; Estates separate
- **SaaS-ready:** `CONFIG.villas[]` array; each villa gets own ID, logo, StayID sequence
- **D1 over Sheets** for Phase 2 — test now, migrate before first SaaS client
- **StayID as primary key** — lifecycle tracked end-to-end, linked to Drive folder
- **GitHub → Cloudflare** deployment (not files in Claude Project) — prevents context bloat
- **All currency INR** throughout
- **Raman commission:** ₹1,000 for 1 night, ₹2,000 for 2+ nights (from master sheet formula)
