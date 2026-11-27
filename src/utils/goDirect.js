// ============================================================
//  GO DIRECT? THE NUMBERS BEHIND THE COMPARISON CARD (src/utils/goDirect.js)
//
//  What it is: the arithmetic of "this booking came through a platform: what would it be worth if the guest booked with us directly?". Pure
//  functions, no screen code, so the card (src/components/GoDirectCard.jsx) only has to draw what these return and the tests can check the
//  rupees. It reads what is already saved on the booking and prices the same stay from the rate card, exactly as the Enquiry screen does; it
//  saves nothing and decides nothing.
//
//    partnerSide(stay, config)        the platform side, from the money saved on the booking: what the guest paid for the stay, what the platform
//                                     keeps (host fee plus any guest fee, the same figure the stay list shows as "Airbnb takes"), what we receive.
//                                     Taxes the guest paid on top are left out on purpose: they are government money, not the value of the stay.
//    directSide({ estimate, ... })    the direct side: the rate-card price for these dates and this many guests (busy seasons night by night),
//                                     an optional discount in percent, and the extras the guest wants (early check-in, breakfast, ...). No platform
//                                     fee, so what the guest pays is what we receive.
//    compare(partner, direct)         what the guest saves and what we keep more, and the same for the room alone (before any extras).
//    flexShares(perNight)             a quarter and a half of a night, the usual price of an early check-in or a late check-out.
//    flexHints(stay, defaults)        the early / late times the guest has already asked for on this booking (never one the owner has declined).
//    startingLines(stay)              the extras already saved on the booking, as the starting extras of the direct quote.
//    quoteFor({ ... })                the enquiry-shaped object the shared quote builder (src/utils/enquiryQuote.js) turns into the WhatsApp message.
//
//  WHAT CHANGED (newest first)
//    2026-11-27  New, for the Complete booking "Go direct?" card (Biji: "build the comparison card first; we will send the quote like Enquiry does").
//  Related: src/utils/partners.js (platformTake: what a platform takes), src/utils/villaPricing.js (the rate-card estimate),
//  src/utils/quoteTimes.js (the early / late hours worded in the quote).
// ============================================================
import { partnerFor, platformTake } from './partners'
import { groupNights } from './seasonRates'
import { stayTimes, toClock, fmtTime } from './stayTimes.js'

// The first non-zero number among a row's fields, whether the row is snake_case (the API) or camelCase (a screen's form).
const num = (row, ...keys) => {
  for (const k of keys) { const v = Number(row && row[k]); if (Number.isFinite(v) && v !== 0) return v }
  return 0
}
// Paise are kept, but never the floating-point crumbs (14752 - 2286.56 must read 12465.44, not 12465.439999...).
const money = n => Math.round((Number(n) || 0) * 100) / 100

// ── THE PLATFORM SIDE ─────────────────────────────────────────────────────
// -> { label, group, guestPays, partnerKeeps, youReceive, pct, estimated, room, extras, guestFee, hasMoney }
//    guestPays    = the stay (night fee + cleaning fee, or the gross without extras when the platform gives no breakdown) + any guest service fee
//                   + extras the guest paid us directly. Same identity as the stored money: guestPays - partnerKeeps = youReceive.
//    partnerKeeps = platformTake().total when the booking has fees saved; otherwise whatever is left between what the guest paid and what we receive.
//    youReceive   = the booking's saved net.
//    hasMoney     = false when the booking's money has not been entered yet (nothing to compare, the card says so).
export function partnerSide(stay, config) {
  const s = stay || {}
  const p = partnerFor(config, s.source)
  const take = platformTake(s, config)
  const extras = num(s, 'extra_charges', 'extraCharges')
  const night = num(s, 'night_fee', 'nightFee')
  const clean = num(s, 'cleaning_fee', 'cleaningFee')
  const guestFee = take ? take.guest : num(s, 'guest_service_fee', 'guestServiceFee')
  const room = (night > 0 || clean > 0) ? night + clean : Math.max(0, num(s, 'gross') - extras)
  const guestPays = money(room + guestFee + extras)
  const youReceive = money(Number(s.net) || 0)
  const partnerKeeps = take ? money(take.total) : money(Math.max(0, guestPays - youReceive))
  return {
    label: p ? p.label : (s.source ? String(s.source) : 'The platform'),
    group: p ? p.group : '',
    guestPays, partnerKeeps, youReceive,
    pct: take && take.pct != null ? take.pct : (room > 0 && partnerKeeps > 0 ? Math.round(partnerKeeps / room * 1000) / 10 : null),
    estimated: !!(take && take.estimated),
    room: money(room), extras: money(extras), guestFee: money(guestFee),
    hasMoney: guestPays > 0 && youReceive > 0,
  }
}

// ── THE DIRECT SIDE ───────────────────────────────────────────────────────
// estimate = getSeasonalEstimate(...) for these dates and this many guests ({ total, nights, ... }); discountPct a number 0 to 100;
// lines = the extras [{ label, amount, earlyCheckinTime?, lateCheckoutTime? }].
// The discount is a percentage of the room price in WHOLE rupees (the Enquiry screen keeps paise; a quote reads cleaner without them); extras are not discounted.
export function directSide({ estimate, discountPct = 0, lines = [] } = {}) {
  const total = money(estimate && estimate.total)
  const pct = Math.min(100, Math.max(0, Number(discountPct) || 0))
  const discountAmount = Math.round(total * pct / 100)
  const roomAfter = money(total - discountAmount)
  const extrasTotal = money((Array.isArray(lines) ? lines : []).reduce((sum, l) => {
    const a = parseFloat(l && l.amount)
    return sum + (a > 0 ? a : 0)
  }, 0))
  const nights = Math.max(1, Number(estimate && estimate.nights) || 1)
  const guestPays = money(roomAfter + extrasTotal)
  return { total, pct, discountAmount, roomAfter, extrasTotal, guestPays, youReceive: guestPays, nights, perNight: Math.round(roomAfter / nights) }
}

// ── WHO SAVES WHAT ────────────────────────────────────────────────────────
// Positive = the direct booking is better for that side. guestSaves can be negative (direct costs the guest more, e.g. with extras),
// and so can youKeepMore (a discount or a cheap rate card can leave us with less than the platform payout).
// roomOnly is the same with the extras taken out of BOTH sides (the extras already paid to us on the platform booking, and the ones on the direct
// quote): a guest who wants an early check-in the platform booking does not include would otherwise make going direct look dearer than it is.
export function compare(partner, direct) {
  const p = partner || {}
  const d = direct || {}
  const partnerExtras = p.extras || 0
  return {
    guestSaves: money((p.guestPays || 0) - (d.guestPays || 0)),
    youKeepMore: money((d.youReceive || 0) - (p.youReceive || 0)),
    roomOnly: {
      guestSaves: money((p.guestPays || 0) - partnerExtras - (d.roomAfter || 0)),
      youKeepMore: money((d.roomAfter || 0) - ((p.youReceive || 0) - partnerExtras)),
    },
  }
}

// A quarter and a half of a night's price: what an early check-in or a late check-out usually costs (the Enquiry screen shows the same two figures).
export function flexShares(perNight) {
  const n = Number(perNight) || 0
  return { quarter: Math.round(n * 0.25), half: Math.round(n * 0.5) }
}

// ── WHAT THE GUEST ALREADY ASKED FOR ──────────────────────────────────────
// defaults = { checkin: '4:00 PM', checkout: '11:00 AM' } (src/utils/villaTimes.js). Only a request the owner has not declined is a hint.
// -> [{ kind: 'early' | 'late', time: 'HH:MM' | '', text }]
export function flexHints(stay, defaults) {
  const s = stay || {}
  const t = stayTimes(s, defaults)
  const out = []
  if ((s.request_early_checkin || t.etaBeforeCheckin) && !t.inDeclined) {
    const time = toClock(s.early_checkin_time) || (t.etaBeforeCheckin ? toClock(s.eta) : '')
    out.push({ kind: 'early', time, text: `The guest asked for an early check-in${time ? `, around ${fmtTime(time)}` : ''}` })
  }
  if ((s.request_late_checkout || t.etdAfterCheckout) && !t.outDeclined) {
    const time = toClock(s.late_checkout_time) || (t.etdAfterCheckout ? toClock(s.etd) : '')
    out.push({ kind: 'late', time, text: `The guest asked for a late check-out${time ? `, until about ${fmtTime(time)}` : ''}` })
  }
  return out
}

// The extras already saved on the booking (a floor bed paid to us, say), as the starting extras of the direct quote so the two sides compare like with like.
// Only what the quote needs is kept: the label, the amount and the hours; the "Paid" stamps stay on the booking.
export function startingLines(stay) {
  let saved = []
  try { saved = stay && stay.extra_lines ? JSON.parse(stay.extra_lines) : [] } catch { saved = [] }
  return (Array.isArray(saved) ? saved : [])
    .filter(l => l && l.label && parseFloat(l.amount) > 0)
    .map(l => {
      const line = { label: String(l.label), amount: parseFloat(l.amount) }
      if (l.earlyCheckinTime) line.earlyCheckinTime = l.earlyCheckinTime
      if (l.lateCheckoutTime) line.lateCheckoutTime = l.lateCheckoutTime
      return line
    })
}

// ── THE QUOTE ─────────────────────────────────────────────────────────────
// The enquiry-shaped object the shared builder (buildQuote / buildQuoteWaLink in src/utils/enquiryQuote.js) writes the message from. With a discount the
// builder uses its DIRECT OFFER version (discount_category 'direct_offer'); without one, the first-contact version with the booked-through-a-platform
// opening (_partnerLabel). Seasons are passed as the nights in runs of one price, as the Enquiry screen does.
export function quoteFor({ stay, label, villaId, adults, children, estimate, direct, lines }) {
  const s = stay || {}
  const withDiscount = direct.pct > 0
  const kept = (Array.isArray(lines) ? lines : []).filter(l => l && l.label)
  return {
    guest_name: s.guest_name || '',
    phone: s.guest_phone || s.phone || '',
    villa_id: villaId,
    checkin_date: s.checkin_date,
    checkout_date: s.checkout_date,
    nights: direct.nights,
    adults, children, guests_count: adults + children,
    quote_amount: direct.total,
    discount_amount: direct.discountAmount,
    final_offer_amount: direct.guestPays,
    discount_category: withDiscount ? 'direct_offer' : null,
    discount_pct: withDiscount ? direct.pct : 0,
    repeat_discount_pct: 0,
    extra_lines: kept.length ? JSON.stringify(kept) : null,
    extra_charges: direct.extrasTotal,
    _seasonGroups: estimate && estimate.seasonal ? groupNights(estimate.perNight) : null,
    _partnerLabel: label,
  }
}
