// Busy-season rates (2026-10-28). The villa's rate card prices a night by party size, the same all year; a SEASON says "for these dates
// the price is different": a percentage on the card, or a card of its own. This module is the one place that turns a rate card, the
// seasons and a stay into a price, per NIGHT (a stay that crosses into a season prices each night by its own date), and is shared by
// the screens (New enquiry, Enquiry detail, the Rates page) and the Worker (the agent quote link), so they cannot disagree.
//
// Pure: no config import, no clock, no Date parsing of strings (a calendar date is plain 'YYYY-MM-DD' text and the only date arithmetic
// is on its parts in UTC, so no time zone can move a night).
//
// A season (camelCase, as the Worker serves it):
//   { id, name, startDate, endDate, yearly, mode: 'percent' | 'card', upliftPct, card: [{ guests, tariff }], minNights, active, notes }
//   startDate..endDate are INCLUSIVE nights ('2026-12-20'..'2027-01-05' = the nights of 20 Dec to 5 Jan). With yearly the year is ignored
//   and the range repeats every year, wrapping over New Year when it starts later in the year than it ends ('12-20'..'01-05').
//   upliftPct is the change on the card's price (+30 = 30% more; negative = a low season). Floor-bed overflow (guests above the card) is
//   a flat charge per guest per night and is NOT scaled by the percentage.
// If two seasons cover a night: a season for one particular year beats a yearly one; otherwise the higher price wins.

export const DEFAULT_OVERFLOW_PER_GUEST = 750
export const DEFAULT_OVERFLOW_MAX = 4
const MAX_NIGHTS = 366

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

// true for a real calendar date written 'YYYY-MM-DD'
export function isYmd(s) {
  const m = YMD.exec(String(s || ''))
  if (!m) return false
  const y = +m[1], mo = +m[2], d = +m[3]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

export function addDaysYmd(ymd, n) {
  const m = YMD.exec(ymd)
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

// The date of each NIGHT of a stay: check-in up to the day before check-out. [] when either is not a date or the stay is not at least
// a night; never more than a year of nights.
export function nightsBetween(checkIn, checkOut) {
  if (!isYmd(checkIn) || !isYmd(checkOut) || checkOut <= checkIn) return []
  const out = []
  for (let d = checkIn; d < checkOut && out.length < MAX_NIGHTS; d = addDaysYmd(d, 1)) out.push(d)
  return out
}

// Does the season's date range cover this night?
export function seasonCoversNight(season, night) {
  if (!season || !isYmd(night) || !isYmd(season.startDate) || !isYmd(season.endDate)) return false
  if (!season.yearly) return season.startDate <= night && night <= season.endDate
  const md = night.slice(5), s = season.startDate.slice(5), e = season.endDate.slice(5)
  return s <= e ? (s <= md && md <= e) : (md >= s || md <= e)
}

// The card's price for a party, and how many guests are above the card: the same lookup the app has always used (an exact row; fewer
// guests than the smallest row pay the smallest row; more than the largest row pay the largest row, the rest are overflow).
export function cardRate(card, billable) {
  const rows = (Array.isArray(card) ? card : []).filter(r => Number(r.guests) > 0 && Number(r.tariff) >= 0)
    .map(r => ({ guests: Number(r.guests), tariff: Number(r.tariff) })).sort((a, b) => a.guests - b.guests)
  if (!rows.length || !(billable > 0)) return { rate: 0, overflowGuests: 0 }
  const exact = rows.find(r => r.guests === billable)
  if (exact) return { rate: exact.tariff, overflowGuests: 0 }
  if (billable < rows[0].guests) return { rate: rows[0].tariff, overflowGuests: 0 }
  const top = rows[rows.length - 1]
  if (billable < top.guests) {   // a gap in the card: the next row down
    const below = [...rows].reverse().find(r => r.guests < billable)
    return { rate: below.tariff, overflowGuests: 0 }
  }
  return { rate: top.tariff, overflowGuests: billable - top.guests }
}

// One night's price for a party under the base card or a season: { rate, overflowGuests }
function priceUnder(season, baseCard, billable, overflowPer) {
  if (season && season.mode === 'card' && Array.isArray(season.card) && season.card.length) {
    const c = cardRate(season.card, billable)
    return { rate: c.rate + c.overflowGuests * overflowPer, overflowGuests: c.overflowGuests }
  }
  const c = cardRate(baseCard, billable)
  const pct = season && season.mode !== 'card' ? Number(season.upliftPct) || 0 : 0
  return { rate: Math.round(c.rate * (1 + pct / 100)) + c.overflowGuests * overflowPer, overflowGuests: c.overflowGuests }
}

// The season that prices a night, or null: a one-year season beats a yearly one, then the higher price wins, then the id.
export function seasonForNight(seasons, night, baseCard, billable, overflowPer = DEFAULT_OVERFLOW_PER_GUEST) {
  let best = null, bestKey = null
  for (const s of (Array.isArray(seasons) ? seasons : [])) {
    if (!s || s.active === false || s.active === 0 || !seasonCoversNight(s, night)) continue
    const key = [s.yearly ? 0 : 1, priceUnder(s, baseCard, billable, overflowPer).rate, String(s.id || '')]
    if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))) { best = s; bestKey = key }
  }
  return best
}

// A stay priced night by night.
//   -> { nights, billableGuests, overflowGuests, withinRecommended, perNight: [{ night, rate, season }], total, baseTotal,
//        tariffPerNight (the average, rounded), seasonal (any night in a season), seasons: [{ id, name, nights, label }],
//        minNightsNotes: [text] }
// With no season in play, tariffPerNight and total are exactly the card's (the old getTariffEstimate).
export function estimateStay({ rateCard, seasons, adults = 0, children = 0, checkIn, checkOut, overflowPerGuest = DEFAULT_OVERFLOW_PER_GUEST, overflowMax = DEFAULT_OVERFLOW_MAX }) {
  const billable = (Number(adults) || 0) + (Number(children) || 0)
  const nightDates = nightsBetween(checkIn, checkOut)
  const base = cardRate(rateCard, billable)
  const perNight = nightDates.map(night => {
    const season = seasonForNight(seasons, night, rateCard, billable, overflowPerGuest)
    const rate = priceUnder(season, rateCard, billable, overflowPerGuest).rate
    return { night, rate, season: season ? { id: season.id, name: season.name } : null, minNights: season ? season.minNights : null }
  })
  const total = perNight.reduce((s, n) => s + n.rate, 0)
  const baseRate = base.rate + base.overflowGuests * overflowPerGuest
  const byId = new Map()
  for (const n of perNight) {
    if (!n.season) continue
    const cur = byId.get(n.season.id) || { id: n.season.id, name: n.season.name, nights: 0 }
    cur.nights++
    byId.set(n.season.id, cur)
  }
  const used = [...byId.values()].map(u => {
    const s = (seasons || []).find(x => x.id === u.id)
    return { ...u, label: seasonPriceLabel(s) }
  })
  const minNightsNotes = used
    .map(u => ({ u, s: (seasons || []).find(x => x.id === u.id) }))
    .filter(({ s }) => s && Number(s.minNights) > nightDates.length)
    .map(({ u, s }) => `${u.name}: minimum ${s.minNights} nights in this season (this stay is ${nightDates.length})`)
  return {
    nights: nightDates.length,
    billableGuests: billable,
    overflowGuests: base.overflowGuests,
    withinRecommended: base.overflowGuests <= overflowMax,
    perNight,
    total,
    baseTotal: baseRate * nightDates.length,
    tariffPerNight: nightDates.length ? Math.round(total / nightDates.length) : baseRate,
    seasonal: used.length > 0,
    seasons: used,
    minNightsNotes,
  }
}

// "+30%", "−10%" (a low season), "own prices"
export function seasonPriceLabel(s) {
  if (!s) return ''
  if (s.mode === 'card') return 'own prices'
  const p = Number(s.upliftPct) || 0
  return `${p < 0 ? '−' : '+'}${Math.abs(p)}%`
}

const dm = ymd => `${+ymd.slice(8, 10)} ${MONTHS[+ymd.slice(5, 7) - 1]}`
// "20 Dec → 5 Jan, every year" / "12 Dec 2026 → 15 Dec 2026"
export function seasonDatesLabel(s) {
  if (!s || !isYmd(s.startDate) || !isYmd(s.endDate)) return ''
  return s.yearly ? `${dm(s.startDate)} → ${dm(s.endDate)}, every year` : `${dm(s.startDate)} ${s.startDate.slice(0, 4)} → ${dm(s.endDate)} ${s.endDate.slice(0, 4)}`
}

// ── validation, shared by the Worker (which refuses) and the Rates page (which explains) ──────────────────────────────────────────
const num = v => (v === '' || v == null ? NaN : Number(v))

// rows [{ guests, tariff }] -> { ok, error, rows } (guests 1..maxGuests, tariff above 0, each guest count once)
export function validateRateCardRows(rows, maxGuests = 12) {
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: 'The rate card needs at least one row' }
  const seen = new Set(), clean = []
  for (const r of rows) {
    const guests = parseInt(r && r.guests, 10), tariff = num(r && r.tariff)
    if (!(guests >= 1 && guests <= maxGuests)) return { ok: false, error: `Guests must be between 1 and ${maxGuests}` }
    if (!(tariff > 0 && tariff <= 1000000)) return { ok: false, error: `The price for ${guests} guest${guests === 1 ? '' : 's'} must be above 0` }
    if (seen.has(guests)) return { ok: false, error: `${guests} guest${guests === 1 ? '' : 's'} is on the card twice` }
    seen.add(guests)
    clean.push({ guests, tariff: Math.round(tariff * 100) / 100 })
  }
  return { ok: true, rows: clean.sort((a, b) => a.guests - b.guests) }
}

// a season as typed -> { ok, error, season } with every field cleaned
export function validateSeason(input, maxGuests = 12) {
  const s = input || {}
  const name = String(s.name || '').trim()
  if (!name) return { ok: false, error: 'Give the season a name' }
  if (name.length > 60) return { ok: false, error: 'The name is too long (60 characters at most)' }
  if (!isYmd(s.startDate) || !isYmd(s.endDate)) return { ok: false, error: 'Choose the first and last night of the season' }
  const yearly = !!(s.yearly === true || s.yearly === 1 || s.yearly === '1')
  if (!yearly && s.endDate < s.startDate) return { ok: false, error: 'The last night is before the first night' }
  if (!yearly && nightsBetween(s.startDate, addDaysYmd(s.endDate, 1)).length >= MAX_NIGHTS) return { ok: false, error: 'A season can be a year long at most' }
  const mode = s.mode === 'card' ? 'card' : 'percent'
  let upliftPct = 0, card = null
  if (mode === 'percent') {
    upliftPct = num(s.upliftPct)
    if (!Number.isFinite(upliftPct) || upliftPct < -90 || upliftPct > 500) return { ok: false, error: 'The price change must be a percentage between −90 and +500' }
    upliftPct = Math.round(upliftPct * 100) / 100
  } else {
    const v = validateRateCardRows(s.card, maxGuests)
    if (!v.ok) return { ok: false, error: `Own prices: ${v.error}` }
    card = v.rows
  }
  let minNights = null
  if (s.minNights !== '' && s.minNights != null) {
    minNights = parseInt(s.minNights, 10)
    if (!(minNights >= 1 && minNights <= 60)) return { ok: false, error: 'The minimum stay must be between 1 and 60 nights' }
  }
  const notes = String(s.notes || '').trim().slice(0, 300)
  return { ok: true, season: { name, startDate: s.startDate, endDate: s.endDate, yearly, mode, upliftPct, card, minNights, active: !(s.active === false || s.active === 0 || s.active === '0'), notes } }
}
