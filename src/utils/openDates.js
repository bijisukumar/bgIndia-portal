// ============================================================
// openDates.js — "which other dates could we offer?"
//
// When the dates an enquirer asked for are taken, the useful reply is not just
// "sorry": it is "sorry, but these are open". This finds windows of the SAME
// number of nights, nearest first, a few before and a few after the dates asked
// for, that nothing occupies.
//
// Pure, and shared: the Worker (checkAvailability) feeds it the villa's taken
// nights, so a night is "taken" by exactly the same rules the calendar uses —
// a booking, a night held by an agreed late check-out / early check-in
// (src/utils/stayHolds.js), or a date closed on a platform's own calendar.
// A stay that checks out on the day another checks in is fine (same-day
// turnover), because a booking takes its NIGHTS, not its check-out day.
// ============================================================
import { addDays } from './stayHolds.js'

// Whole nights from checkIn to checkOut ('YYYY-MM-DD' both), 0 when not after.
export function nightCount(checkIn, checkOut) {
  const a = Date.parse(String(checkIn) + 'T00:00:00Z')
  const b = Date.parse(String(checkOut) + 'T00:00:00Z')
  if (isNaN(a) || isNaN(b) || b <= a) return 0
  return Math.round((b - a) / 86400000)
}

// Every night of the half-open ranges [start, end) plus the single nights, as a Set
// of 'YYYY-MM-DD'. A range that is absurdly long is clipped, not trusted.
export function takenNights({ ranges = [], nights = [] } = {}) {
  const taken = new Set()
  for (const r of ranges) {
    const n = Math.min(nightCount(r && r.start, r && r.end), 800)
    for (let i = 0; i < n; i++) taken.add(addDays(r.start, i))
  }
  for (const d of nights) if (d) taken.add(d)
  return taken
}

// checkIn / checkOut: the dates asked for. today: the villa's today ('YYYY-MM-DD'),
// so nothing in the past is offered. before / after: how many windows to offer on
// each side. They are kept apart: a window that overlaps one already offered is
// the same offer a day later, so it is skipped.
//
// Returns { nights, before: [{checkIn, checkOut}], after: [{checkIn, checkOut}] };
// `before` is oldest first, `after` too. For a request longer than a month, or
// with no nights, there is nothing sensible to offer and both are empty.
export function otherDates({ taken, checkIn, checkOut, today, before = 2, after = 3, lookBack = 45, lookAhead = 75 }) {
  const n = nightCount(checkIn, checkOut)
  const none = { nights: n, before: [], after: [] }
  if (n < 1 || n > 30 || !(taken instanceof Set)) return none

  const free = a => {
    for (let i = 0; i < n; i++) if (taken.has(addDays(a, i))) return false
    return true
  }
  const pick = (starts, count) => {
    const out = []
    for (const a of starts) {
      if (out.length >= count) break
      if (today && a < today) continue
      if (!free(a)) continue
      const b = addDays(a, n)
      if (out.some(w => a < w.checkOut && b > w.checkIn)) continue
      out.push({ checkIn: a, checkOut: b })
    }
    return out
  }

  const earlier = [], later = []
  for (let d = 1; d <= lookBack; d++)  earlier.push(addDays(checkIn, -d))
  for (let d = 1; d <= lookAhead; d++) later.push(addDays(checkIn, d))

  return {
    nights: n,
    before: pick(earlier, before).sort((x, y) => (x.checkIn < y.checkIn ? -1 : 1)),
    after:  pick(later, after),
  }
}
