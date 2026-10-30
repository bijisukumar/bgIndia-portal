// The DATES an Airbnb "<guest> wants to change their reservation" email asks for.
//
// The Gmail poller hands the Worker the email's own words (`detail`), which carry something like
//   "... ORIGINAL DATES Dec 18, 2026 - Dec 21, 2026 REQUESTED DATES Dec 18, 2026 - Dec 22, 2026 If you accept ..."
// Until 2026-10-29 only a change of GUEST NUMBERS was read from it: Srinidhi Srinivasan's request to add a night was saved as a
// bare "a change to the reservation", the owner approved it, and the stay kept its old check-out (3 nights, 21 Dec) while Airbnb
// said 22 Dec. Pure (no clock, no database) so the Worker and the tests share it.
import { dayMonth } from './stayHolds.js'

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const p2 = n => String(n).padStart(2, '0')

function iso(y, m, d) {
  y = +y; m = +m; d = +d
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${p2(m)}-${p2(d)}` : null
}

// "Dec 18, 2026", "December 18 2026" or "18 Dec 2026" -> '2026-12-18'
function parseOneDate(s) {
  let m = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(s)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return iso(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2])
  m = /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/.exec(s)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return iso(m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], m[1])
  return null
}

// Two dates separated by a dash, an en dash or "to": the first date in `s` and the one after it. Also the compact form with the
// month and the year written once ("Dec 18 - 21, 2026", "Dec 30 - Jan 2, 2027"). No year, no dates: a range with no year is
// never guessed at.
function parseRange(s) {
  const str = String(s || '').trim()
  const parts = str.split(/\s*[-–—]\s*|\s+to\s+/i)
  if (parts.length >= 2) {
    const a = parseOneDate(parts[0]), b = parseOneDate(parts[1])
    if (a && b) return b > a ? { from: a, to: b } : null
  }
  const m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*(?:[-–—]|to)\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2}),?\s+(\d{4})/i.exec(str)
  if (!m) return null
  const m1 = MONTHS[m[1].slice(0, 3).toLowerCase()], m2 = m[3] ? MONTHS[m[3].slice(0, 3).toLowerCase()] : m1
  if (!m1 || !m2) return null
  const year = +m[5]
  const a = iso(m1 > m2 ? year - 1 : year, m1, m[2]), b = iso(year, m2, m[4])
  return a && b && b > a ? { from: a, to: b } : null
}

const nightsBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)

// -> null when the text asks for no dates at all, else
//    { originalCheckin, originalCheckout, requestedCheckin, requestedCheckout, originalNights, requestedNights, changed }
export function parseDateChange(detail) {
  const text = String(detail || '').replace(/\s+/g, ' ')
  const orig = /ORIGINAL\s+DATES?\s*[:\-]?\s*(.{0,60})/i.exec(text)
  const req = /REQUESTED\s+DATES?\s*[:\-]?\s*(.{0,60})/i.exec(text)
  if (!orig || !req) return null
  const o = parseRange(orig[1].split(/REQUESTED/i)[0]), r = parseRange(req[1])
  if (!o || !r) return null
  return {
    originalCheckin: o.from, originalCheckout: o.to, requestedCheckin: r.from, requestedCheckout: r.to,
    originalNights: nightsBetween(o.from, o.to), requestedNights: nightsBetween(r.from, r.to),
    changed: o.from !== r.from || o.to !== r.to,
  }
}

// The nights the new dates ADD to the booking, as [from, to) ranges (the old nights are the booking's already).
export function addedNightRanges(dc) {
  if (!dc || !dc.changed) return []
  const out = []
  let start = null
  for (let d = dc.requestedCheckin; d < dc.requestedCheckout; d = new Date(Date.parse(d + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)) {
    const old = d >= dc.originalCheckin && d < dc.originalCheckout
    if (!old && start === null) start = d
    if (old && start !== null) { out.push([start, d]); start = null }
  }
  if (start !== null) out.push([start, dc.requestedCheckout])
  return out
}

// How a pending change reads on a screen. `pc` is the pendingChange the Worker hands every screen (publicChange): its
// `requestedDates` is set when the Airbnb email moves the dates, `requestedGuests` when it changes the head count (one email
// can do both). The head count is part of a request unless the request is only about the dates.
//   changeNoun   'dates' | 'guests' | 'guests and dates'
//   changeDetail '18 Dec to 21 Dec → 18 Dec to 22 Dec' | '6 → 8' | '6 → 8; 18 Dec to 21 Dec → 18 Dec to 22 Dec'
//   changeWords  'dates 18 Dec to 21 Dec → 18 Dec to 22 Dec' | 'guests 6 → 8'
const hasDates = pc => !!(pc && pc.requestedDates)
const hasGuests = pc => !!pc && (pc.requestedGuests != null || !hasDates(pc))

export const changeNoun = pc => (hasDates(pc) && hasGuests(pc) ? 'guests and dates' : hasDates(pc) ? 'dates' : 'guests')

export function changeDetail(pc) {
  if (!pc) return ''
  const d = pc.requestedDates
  return [
    hasGuests(pc) ? `${pc.originalGuests ?? '?'} → ${pc.requestedGuests ?? '?'}` : '',
    d ? `${dayMonth(d.originalFrom)} to ${dayMonth(d.originalTo)} → ${dayMonth(d.from)} to ${dayMonth(d.to)}` : '',
  ].filter(Boolean).join('; ')
}

export const changeWords = pc => (pc ? `${changeNoun(pc)} ${changeDetail(pc)}` : '')

// 'Guests 6 → 8' style heading: the noun with a capital.
export const changeTitle = pc => { const n = changeNoun(pc); return n.charAt(0).toUpperCase() + n.slice(1) }

// What the staff screens say is "not settled": 'dates', 'guest count' or 'guest count and dates'.
export const changeSubject = pc => (hasDates(pc) && hasGuests(pc) ? 'guest count and dates' : hasDates(pc) ? 'dates' : 'guest count')
