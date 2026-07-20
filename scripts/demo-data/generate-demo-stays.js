#!/usr/bin/env node
// ============================================================================
// GENERATE DEMO STAYS — builds N years of realistic booking history for a
// sales-demo tenant (default: demovilla), as a single SQL file to review
// before applying.
//
// Usage:
//   node scripts/demo-data/generate-demo-stays.js --villa=demovilla --years=3
//   npx wrangler d1 execute demovilla-db --file=scripts/demo-data/generated-demo-stays.sql --remote
//
// Design notes (see plan / DEMO-ONBOARDING-WALKTHROUGH.md for the why):
// - A villa is a SINGLE resource — stays are generated as a non-overlapping
//   walk across the calendar (gap, then a stay, then a gap...), not just
//   scattered randomly, so the dataset could actually have happened.
// - Seasonality (Nov-Feb high season, Jun-Sep monsoon lull) is expressed by
//   shrinking/stretching the gap between bookings depending on the month —
//   this keeps every stay physically valid while still producing a
//   convincing seasonal curve in the Statistics tab.
// - stayvibe_booking_line_items is NOT auto-derived from stayvibe_stays in
//   the real app — it's written by the worker's syncStayLedger() whenever a
//   stay is saved. This script replicates that logic directly (6 item
//   types, same line_id convention `${stay_id}:${item_type}`) since we're
//   writing straight to D1, not going through the API.
// - The walk continues 60 days past "today" (at generation time) so
//   OwnerHome's ChannelMixBlock (current month) and GapAlertBlock (next 60
//   days) have something to show immediately after a reseed — reseed before
//   every demo so "today" stays current.
// ============================================================================

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ── CLI args ────────────────────────────────────────────────────────────
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v === undefined ? true : v]
}))
const VILLA_ID = args.villa || 'demovilla'
const YEARS = parseInt(args.years || '3', 10)
const SEED = parseInt(args.seed || '42', 10)
const OUT = args.out || path.join(__dirname, 'generated-demo-stays.sql')

// ── seeded RNG (mulberry32) — reproducible runs unless --seed differs ────
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const randInt = (min, max) => Math.floor(min + rand() * (max - min + 1))
function weightedPick(items) {
  // items: [{..., weight}]
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = rand() * total
  for (const item of items) { r -= item.weight; if (r <= 0) return item }
  return items[items.length - 1]
}

// ── helpers ────────────────────────────────────────────────────────────
function fmtDate(d) { return d.toISOString().slice(0, 10) }
function fmtDateTime(d) { return d.toISOString().slice(0, 19).replace('T', ' ') }
function addDays(d, n) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r }
function daysBetween(a, b) { return Math.round((b - a) / 86400000) }
function sqlStr(v) { return v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'` }
function sqlNum(v) { return v === null || v === undefined ? 'NULL' : Number(v) }

let idCounter = 1
function nextStayId(year) {
  return `DEMO-${year}-${String(idCounter++).padStart(5, '0')}`
}

// ── reference data ─────────────────────────────────────────────────────
const FIRST_NAMES = ['Aarav','Vivaan','Aditya','Ishaan','Arjun','Kabir','Rohan','Nikhil','Priya','Ananya',
  'Diya','Sneha','Kavya','Meera','Pooja','Ritu','Sarah','James','Michael','Emma','Olivia','Liam','Noah',
  'Sophia','Ava','Daniel','Thomas','Chloe','Grace','David','Rahul','Sanjay','Deepa','Lakshmi','Manoj']
const LAST_NAMES = ['Nair','Menon','Pillai','Kurup','Iyer','Reddy','Rao','Sharma','Gupta','Verma','Kumar',
  'Nambiar','Varma','Thomas','George','Mathew','Smith','Johnson','Brown','Wilson','Anderson','Taylor']
function guestName() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` }

const CHANNELS = [
  { key: 'direct',      weight: 50, commission: 0  },
  { key: 'airbnb',      weight: 22, commission: 3  },
  { key: 'booking.com', weight: 16, commission: 17 },
  { key: 'makemytrip',  weight: 6,  commission: 15 },
  { key: 'agoda',       weight: 4,  commission: 15 },
  { key: 'expedia',     weight: 2,  commission: 15 },
]

// Kerala tourism seasonality — higher factor = shorter gaps = more occupied
const MONTH_FACTOR = { 1: 1.4, 2: 1.3, 3: 1.0, 4: 0.8, 5: 0.7, 6: 0.5, 7: 0.5, 8: 0.5, 9: 0.6, 10: 0.9, 11: 1.3, 12: 1.5 }

const RATE_CARD = { 1: 3000, 2: 3000, 3: 4000, 4: 5000, 5: 6000, 6: 7000, 7: 8000, 8: 9000, 9: 10000, 10: 11000 }
const GUEST_COUNT_WEIGHTS = [
  { v: 1, weight: 5 }, { v: 2, weight: 20 }, { v: 3, weight: 15 }, { v: 4, weight: 20 }, { v: 5, weight: 15 },
  { v: 6, weight: 10 }, { v: 7, weight: 5 }, { v: 8, weight: 5 }, { v: 9, weight: 3 }, { v: 10, weight: 2 },
]
const LENGTH_BUCKETS = [
  { min: 1, max: 2, weight: 30 }, { min: 3, max: 4, weight: 40 },
  { min: 5, max: 7, weight: 20 }, { min: 8, max: 14, weight: 10 },
]
const LEAD_BUCKETS = [
  { min: 1, max: 7, weight: 25 }, { min: 8, max: 30, weight: 35 },
  { min: 31, max: 90, weight: 30 }, { min: 91, max: 120, weight: 10 },
]

const KITCHEN_ITEMS = [
  { name: 'Bottled Water (1L)', unit: 'bottle', cost: 15, sell: 40 },
  { name: 'Local Snacks Basket', unit: 'basket', cost: 150, sell: 350 },
  { name: 'Beer (King Fisher)', unit: 'bottle', cost: 90, sell: 200 },
  { name: 'Soft Drinks', unit: 'bottle', cost: 25, sell: 60 },
  { name: 'Breakfast Add-on', unit: 'plate', cost: 120, sell: 300 },
  { name: 'Fresh Coconut Water', unit: 'piece', cost: 20, sell: 50 },
]

const EXPENSE_CATEGORIES = [
  { category: 'Staff Salary', base: 15000, variance: 1000 },
  { category: 'Utilities',    base: 3500,  variance: 800  },
  { category: 'Maintenance',  base: 2000,  variance: 1500 },
  { category: 'Marketing',    base: 1500,  variance: 700  },
]

// ── build the non-overlapping stay timeline ────────────────────────────
const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
const startDate = addDays(today, -365 * YEARS)
const endDate = addDays(today, 60)

const stays = []
let pointer = new Date(startDate)
while (pointer < endDate) {
  const month = pointer.getUTCMonth() + 1
  const factor = MONTH_FACTOR[month]
  const gapDays = Math.round(randInt(0, 6) / factor)
  pointer = addDays(pointer, gapDays)
  if (pointer >= endDate) break

  const bucket = weightedPick(LENGTH_BUCKETS)
  let nights = randInt(bucket.min, bucket.max)
  let checkin = new Date(pointer)
  let checkout = addDays(checkin, nights)
  if (checkout > endDate) { checkout = new Date(endDate); nights = daysBetween(checkin, checkout) }
  if (nights < 1) break

  stays.push({ checkin, checkout, nights })
  pointer = checkout
}

// ── a handful of independent cancelled/void bookings (never occupied the
//    calendar for real, so they're allowed to land on already-booked dates) ──
const cancelledCount = Math.round(stays.length * 0.04)
for (let i = 0; i < cancelledCount; i++) {
  const offsetDays = randInt(0, daysBetween(startDate, today))
  const checkin = addDays(startDate, offsetDays)
  const nights = randInt(1, 5)
  stays.push({ checkin, checkout: addDays(checkin, nights), nights, cancelled: true })
}

stays.sort((a, b) => a.checkin - b.checkin)

// ── flesh out each stay with guest/financial/status detail ────────────
const rows = { stays: [], lineItems: [], commissions: [], expenses: [], inventory: [], incidentals: [] }

for (const s of stays) {
  const year = s.checkin.getUTCFullYear()
  const stayId = nextStayId(year)
  const channel = weightedPick(CHANNELS)
  const guests = weightedPick(GUEST_COUNT_WEIGHTS).v
  const baseTariff = RATE_CARD[guests]
  const tariff = Math.round(baseTariff * (0.95 + rand() * 0.10))

  const roomFee = tariff * s.nights
  const cleaningFee = Math.round(1200 * (0.9 + rand() * 0.2))
  const upsellRoll = rand()
  let extraCharges = 0
  if (upsellRoll < 0.15) extraCharges = randInt(500, 2500)
  else if (upsellRoll < 0.23) extraCharges = -randInt(300, 1500)

  const gross = roomFee + cleaningFee + extraCharges
  const commissionPct = channel.commission
  const commissionAmt = Math.round(gross * commissionPct / 100)
  const net = gross - commissionAmt
  const guestServiceFee = channel.key !== 'direct' ? Math.round(gross * 0.03) : 0
  const guestPaidTotal = gross + guestServiceFee
  const hostServiceFee = commissionAmt

  const leadBucket = weightedPick(LEAD_BUCKETS)
  const leadDays = randInt(leadBucket.min, leadBucket.max)
  const createdAt = addDays(s.checkin, -leadDays)
  createdAt.setUTCHours(randInt(7, 22), randInt(0, 59), 0, 0)

  let status, reviewRating = null, reviewDate = null
  if (s.cancelled) {
    status = rand() < 0.9 ? 'cancelled' : 'void'
  } else if (s.checkout < today) {
    status = 'checked_out'
    if (rand() < 0.92) {
      reviewRating = weightedPick([{ v: 5, weight: 65 }, { v: 4, weight: 30 }, { v: 3, weight: 5 }]).v
      reviewDate = fmtDate(addDays(s.checkout, randInt(1, 6)))
    }
  } else if (s.checkin <= today && today <= s.checkout) {
    status = 'checked_in'
  } else {
    status = rand() < 0.85 ? 'confirmed' : 'booked'
  }

  rows.stays.push(`(${[
    sqlStr(stayId), sqlStr(VILLA_ID), sqlStr(channel.key), sqlStr(guestName()),
    sqlStr(fmtDate(s.checkin)), sqlStr(fmtDate(s.checkout)), sqlNum(s.nights),
    sqlNum(Math.max(1, guests - randInt(0, 1))), sqlNum(Math.min(2, Math.max(0, guests - 4))),
    sqlNum(tariff), sqlNum(extraCharges), sqlNum(gross), sqlNum(commissionPct), sqlNum(commissionAmt),
    sqlNum(net), sqlStr(status), sqlStr(fmtDateTime(createdAt)), sqlStr(fmtDateTime(createdAt)),
    sqlNum(cleaningFee), sqlNum(hostServiceFee), sqlNum(net), sqlNum(guestServiceFee), sqlNum(roomFee),
    sqlNum(guestPaidTotal), reviewRating === null ? 'NULL' : sqlNum(reviewRating),
    reviewDate === null ? 'NULL' : sqlStr(reviewDate),
  ].join(', ')})`)

  if (!s.cancelled) {
    const items = [
      ['room_fee', 'inflow', roomFee],
      ['cleaning_fee', 'inflow', cleaningFee],
    ]
    if (extraCharges > 0) items.push(['extra_charge', 'inflow', extraCharges])
    if (extraCharges < 0) items.push(['discount', 'outflow', Math.abs(extraCharges)])
    if (commissionAmt > 0) items.push(['channel_commission', 'outflow', commissionAmt])
    if (guestServiceFee > 0) items.push(['guest_service_fee', 'passthrough', guestServiceFee])

    for (const [itemType, direction, amount] of items) {
      rows.lineItems.push(`(${[
        sqlStr(`${stayId}:${itemType}`), sqlStr(stayId), sqlStr(VILLA_ID), sqlStr(itemType),
        sqlStr(direction), sqlNum(amount), sqlNum(0), sqlStr(fmtDateTime(createdAt)),
      ].join(', ')})`)
    }

    // manager commission — flat per-night rate, paid once >30 days old
    const commission = s.nights * 300
    const isPaid = s.checkout < addDays(today, -30)
    const paidDate = isPaid ? fmtDate(addDays(s.checkout, 15)) : null
    rows.commissions.push(`(${[
      sqlStr(`${stayId}-comm`), sqlStr(stayId), sqlStr('Demo Manager'), sqlStr(fmtDate(s.checkin)),
      sqlNum(s.nights), sqlNum(commission), sqlNum(isPaid ? 1 : 0),
      paidDate === null ? 'NULL' : sqlStr(paidDate), sqlStr(fmtDateTime(createdAt)),
    ].join(', ')})`)

    // occasional kitchen incidental
    if (status === 'checked_out' && rand() < 0.25) {
      const item = pick(KITCHEN_ITEMS)
      const qty = randInt(1, 4)
      const total = qty * item.sell
      const incidentAt = addDays(s.checkin, randInt(0, s.nights))
      rows.incidentals.push({ item, qty, total, stayId, incidentAt })
    }
  }
}

// ── kitchen inventory master rows ──────────────────────────────────────
const inventoryIds = {}
for (const item of KITCHEN_ITEMS) {
  const itemId = `demo-inv-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  inventoryIds[item.name] = itemId
  rows.inventory.push(`(${[
    sqlStr(itemId), sqlStr(VILLA_ID), sqlStr(item.name), sqlStr(item.unit), sqlStr('kitchen'),
    sqlNum(randInt(10, 40)), sqlNum(item.cost), sqlNum(item.sell), sqlStr(fmtDate(today)),
  ].join(', ')})`)
}
const incidentalRows = rows.incidentals.map((inc, i) => `(${[
  sqlStr(`demo-inc-${i + 1}`), sqlStr(inc.stayId), sqlStr(inventoryIds[inc.item.name]), sqlStr(inc.item.name),
  sqlNum(inc.qty), sqlNum(inc.item.sell), sqlNum(inc.total), sqlStr(fmtDateTime(inc.incidentAt)),
].join(', ')})`)

// ── recurring monthly expenses across the whole span ───────────────────
for (let m = 0; m < 12 * YEARS; m++) {
  const d = addDays(startDate, m * 30)
  if (d >= today) break
  for (const exp of EXPENSE_CATEGORIES) {
    const amount = Math.round(exp.base + (rand() * 2 - 1) * exp.variance)
    rows.expenses.push(`(${[
      sqlStr(`demo-exp-${m}-${exp.category.replace(/\s+/g, '')}`), sqlStr(VILLA_ID),
      sqlStr(fmtDate(addDays(d, randInt(1, 8)))), sqlStr(exp.category), sqlNum(amount),
      sqlStr('Demo Vendor'), sqlStr(`${exp.category} — demo data`), sqlStr(fmtDateTime(d)),
    ].join(', ')})`)
  }
}

// ── write SQL file ──────────────────────────────────────────────────────
function chunkInsert(table, columns, values, chunkSize = 100) {
  if (values.length === 0) return ''
  let sql = ''
  for (let i = 0; i < values.length; i += chunkSize) {
    sql += `INSERT INTO ${table} (${columns}) VALUES\n  ${values.slice(i, i + chunkSize).join(',\n  ')};\n\n`
  }
  return sql
}

let sql = `-- ============================================================================\n`
sql += `-- GENERATED DEMO DATA — villa_id='${VILLA_ID}', ${YEARS} years, seed=${SEED}\n`
sql += `-- Generated at ${new Date().toISOString()} by scripts/demo-data/generate-demo-stays.js\n`
sql += `-- Run: npx wrangler d1 execute demovilla-db --file=${path.basename(OUT)} --remote\n`
sql += `-- Reset first with scripts/demo-data/reset-demo-stays.sql if reseeding.\n`
sql += `-- ============================================================================\n\n`

sql += chunkInsert('stayvibe_stays',
  `stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, adults, children,
   tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net, status, created_at, updated_at,
   cleaning_fee, host_service_fee, you_earn, guest_service_fee, night_fee, guest_paid_total, review_rating, review_date`,
  rows.stays)

sql += chunkInsert('stayvibe_booking_line_items',
  `line_id, stay_id, villa_id, item_type, direction, gross_amount, tax_amount, created_at`,
  rows.lineItems)

sql += chunkInsert('stayvibe_manager_commissions',
  `comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, paid_date, created_at`,
  rows.commissions)

sql += chunkInsert('stayvibe_inventory',
  `item_id, villa_id, name, unit, category, qty_in_stock, cost_price, sell_price, last_restocked`,
  rows.inventory)

sql += chunkInsert('stayvibe_incidentals',
  `item_id, stay_id, inv_item_id, name, qty, price_per_unit, total, created_at`,
  incidentalRows)

sql += chunkInsert('stayvibe_villa_expenses',
  `txn_id, villa_id, date, category, amount, paid_to, description, created_at`,
  rows.expenses)

fs.writeFileSync(OUT, sql)
console.log(`Wrote ${OUT}`)
console.log(`  stays: ${rows.stays.length} (${cancelledCount} cancelled/void)`)
console.log(`  booking line items: ${rows.lineItems.length}`)
console.log(`  manager commissions: ${rows.commissions.length}`)
console.log(`  inventory items: ${rows.inventory.length}`)
console.log(`  kitchen incidentals: ${incidentalRows.length}`)
console.log(`  villa expenses: ${rows.expenses.length}`)
