# Canonical Ledger Refactor — DB + Screen Changes Spec (v2)

**Status:** Approved (v1 + four refinements folded in). Step A executed
2026-07-06. Step B is in dry-run review — no backfill writes yet.

**Goal:** make the money model correct and channel-agnostic *in storage*, so
Booking.com / Expedia / any future OTA plug in cleanly, GST/ITC reporting
falls out, and the dashboard is honest from the data (no read-time patches).

**Non-negotiable invariant:** `net = gross − channel_commission`, true in the
data, enforced on write, covered by a test.

---

## 1. Design principles

1. **`stays` stays.** It's the operational record (check-in, docs, OCR,
   Raman). We do **not** replace it — a financial ledger goes *underneath* it.
2. **Line-item ledger is the source of truth** for money.
   `stays.gross / commission_amt / net` become **roll-up columns computed from
   the ledger**, so every existing screen keeps reading three simple columns
   and doesn't change.
3. **One adapter, per-channel mapping.** Each channel's raw numbers map into
   canonical line items in *one* place. A new OTA = one small mapping.
4. **Controlled vocabularies.** `item_type` and `direction` are fixed lists
   defined once (same discipline that bit us on statuses/void).
5. **P&L is four-part:** `Net to owner = gross − channel commission − staff
   commission − expenses`. Staff commission (`raman_commissions`) and expenses
   (`villa_expenses`) are separate inputs, not booking line items.

## 2. Tables

DDL lives in `scripts/ledger-step-a-create-tables.sql` (idempotent; executed).
Four tables: `channels` (seeded), `booking_line_items`, `payouts`,
`payout_map`.

## 3. Controlled vocabularies

| item_type | direction | in P&L? |
|---|---|---|
| `room_fee` | inflow | yes (gross) |
| `cleaning_fee` | inflow | yes (gross) |
| `extra_charge` | inflow | yes (gross) |
| `discount` | outflow | yes (reduces gross) |
| `channel_commission` | outflow | yes (commission) |
| `guest_service_fee` | passthrough | **no** — guest-paid, not villa revenue |
| `guest_tax` | passthrough | **no** — GST collected on channel's behalf |

## 4. Roll-up definition (item_type-explicit)

```
gross      = Σ(room_fee + cleaning_fee + extra_charge) − Σ(discount)
commission = Σ(channel_commission)
net        = gross − commission
```

- Explicit by `item_type`, **not** by direction alone — passthrough items can
  never leak into P&L, and adding a future item_type forces a deliberate
  decision about where it counts.
- Every write applies `Math.round(x * 100) / 100` (SQL: `ROUND(x, 2)`), so
  float drift can't accumulate across line items into the roll-up.

## 5. The four approved refinements (v1 → v2)

1. **`payout_map` surrogate PK** — `map_id TEXT PRIMARY KEY` replaces the
   composite `(payout_id, stay_id)`, with nullable `line_id`. A stay can now
   receive multiple settlement events (modification, partial refund,
   adjustment) without key collisions; allocation can be stay- or line-level.
2. **Roll-up is item_type-explicit** (see §4) rather than direction-summed.
3. **2-decimal rounding on every write** (see §4).
4. **Passthrough exclusion** — `guest_service_fee` and `guest_tax` are stored
   for reconciliation against `guest_paid_total` but excluded from gross/net.

## 6. §8 decisions (approved)

- Extras count as villa gross revenue ✅ (e.g. a re-billed night lands as an
  `extra_charge` inflow).
- Guest service fee stays a passthrough — not villa revenue ✅.
- GST deferred: `tax_amount = 0` on backfill, real GST captured when
  Booking.com (which itemizes GST) lands — but the `tax_amount` column ships
  in the DDL **now** so the schema never changes again ✅.

## 7. Build order

| Step | What | Status |
|---|---|---|
| A | Create tables + seed channels | ✅ done (`scripts/ledger-step-a-create-tables.sql`) |
| B | Backfill: decode historical `stays` rows into line items | ✅ done 2026-07-06 — dry-run approved (293 in scope, 291 OK, 2 confirmed extras corrections), apply executed (469 lines), invariant violations 0 |
| C | Channel adapter on the write path | ✅ done — `syncStayLedger()` wired into all 5 financial write paths, non-blocking, roll-ups from ledger |
| D | P&L dashboard boxes (Gross incl. upsell breakout · Channel comm · Staff comm · Expenses → Net to owner) | ✅ done — ledger-derived `pnl` in getVillaDashboard + overview card |
| E | Write-time invariant + contract test | invariant enforced by construction in adapter; contract test pending |

Payouts UI + GST report are parked until Booking.com actually lands.

## 8. Step B backfill decode rules (historical rows)

Scope: `status NOT IN ('cancelled','void')`.

| Ledger line | Source | Rule |
|---|---|---|
| `room_fee` | `night_fee` when > 0 (Airbnb-authoritative), else `gross − cleaning_fee − extra_charges` | derived flag shown in preview |
| `cleaning_fee` | `cleaning_fee` | only if > 0 |
| `extra_charge` | `extra_charges` when **positive** | |
| `discount` | `ABS(extra_charges)` when **negative** | today's `extra_charges` is a single net column, so any negative value is surfaced explicitly in the dry-run as a candidate `discount` — **NEEDS-CONFIRM, never silently summed** |
| `channel_commission` | `commission_amt` | only if > 0 |
| `guest_service_fee` | `guest_service_fee` | passthrough |
| `guest_tax` | — | no historical column; 0 on backfill |

The dry-run's reconciliation queries prove `ledger roll-up == stored
gross/net` (±₹1 rounding tolerance) per row before any INSERT, and list every
DIFF row for review.

## 9. Verification workflow

1. Run `scripts/ledger-step-b-dryrun-preview.sql` (read-only) in the D1
   console / via wrangler.
2. Review: representative stays' exploded line items (Query 1), their roll-up
   reconciliation (Query 2), and the full-table OK/DIFF summary + DIFF list
   (Query 3).
3. Confirm every negative-extras row's `discount` reclassification.
4. Only then does the Step B **apply** script (INSERTs) get written and run.
