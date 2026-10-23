// Shared date helpers for working with plain "YYYY-MM-DD" calendar-date strings
// (checkin_date, checkout_date, follow_up_due, etc.) stored in D1.
//
// THE BUG THIS FIXES:
// `new Date("2026-07-01")` parses the string as UTC midnight. When later
// displayed with .toLocaleDateString() in a timezone *behind* UTC (e.g. IST
// viewers reading a server response, or any US timezone), JS converts that
// UTC instant back to local time — which rolls it back to the previous day
// (e.g. "30 Jun" instead of "1 Jul"). These are calendar dates, not instants
// in time, so they must be parsed as local-time components, never through
// the bare ISO-string Date constructor.
//
// Always use parseLocalDate() instead of `new Date(dateString)` for any
// YYYY-MM-DD value before formatting or doing date arithmetic on it.

import {
  DEFAULT_TIMEZONE, zoneName, offsetMs, todayInZone, dateInZone,
  clock12, clock12s, stampShort, stampYear, stampLong, zoneAbbr,
} from './tz'

// The property's time zone: `timezone` in hosts/<id>/config.js, set once the config has loaded
// (src/config.js). One property per browser tab, so a single value is right here; the Worker serves
// many properties and passes the zone explicitly (utils/tz.js) instead of using this.
let propertyZone = DEFAULT_TIMEZONE
export function setPropertyZone(tz) { propertyZone = zoneName(tz) }
export function getPropertyZone() { return propertyZone }

export function parseLocalDate(d) {
  if (!d) return null
  const s = String(d).slice(0, 10)
  const parts = s.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null
  const [y, m, day] = parts
  return new Date(y, m - 1, day) // local midnight — no UTC shift on display
}

export function fmtDate(d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const parsed = parseLocalDate(d)
  if (!parsed) return '—'
  try { return parsed.toLocaleDateString('en-IN', opts) } catch { return '—' }
}

export function daysBetween(d1, d2) {
  const a = parseLocalDate(d1)
  const b = parseLocalDate(d2)
  if (!a || !b) return 0
  return Math.round((b - a) / 86400000)
}

// Whole days from the property's today to the date (negative = in the past).
export function daysFromToday(d) {
  const a = parseLocalDate(d)
  if (!a) return null
  return Math.round((a - parseLocalDate(localTodayStr())) / 86400000)
}

// "Today" as a YYYY-MM-DD string: the PROPERTY's today, in the time zone its config names. Not the
// phone's date and not the owner's computer's: an owner in Texas looking at an Indian villa at 9 PM
// is already looking at tomorrow in India, and `new Date().toISOString().slice(0,10)` (the UTC date)
// is yesterday for the first five and a half hours of every Indian day. Use this anywhere a date
// input or a "today" constant needs the current date. (The name says "local" because it was once the
// browser's; "local" now means local to the property. scripts/check-time.mjs bans the other ways.)
export function localTodayStr() {
  return todayInZone(propertyZone)
}

// This year / this month (0-11, like Date#getMonth) at the property: the year-end and month-end
// hours differ between the property and the phone, so the machine's `new Date().getFullYear()` is out.
export function propertyYear()  { return Number(localTodayStr().slice(0, 4)) }
export function propertyMonth() { return Number(localTodayStr().slice(5, 7)) - 1 }

// Formats a 24h "HH:MM" time value (as produced by <input type="time">) into
// a friendly 12h display string, e.g. "14:00" -> "2:00 PM". Returns '' for
// anything that isn't a clean HH:MM string rather than throwing, since this
// is always used directly against a possibly-unset DB field.
export function formatTime12h(t) {
  if (!t) return ''
  const m = String(t).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return ''
  let h = parseInt(m[1], 10)
  const min = m[2]
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${min} ${suffix}`
}

// ── a STORED MOMENT, shown as the clock at the property ───────────────────────────────────────────
// created_at, updated_at, actual_checkin_at, last_synced_at ... are 'YYYY-MM-DD HH:MM:SS' in UTC with
// no marker. Showing that string, or running it through `new Date()`, shows the wrong hour (5½ hours
// off for India, and different again for every viewer). EVERY such value is shown through these and
// nothing else; scripts/check-time.mjs fails the build on the old ways. Each returns '—' for a value
// that is not a moment. (formatTime12h above is for a wall-clock 'HH:MM' - eta, late_checkout_time -
// which is already the property's clock and is never converted.)
export function fmtClock(v)     { return clock12(v, propertyZone)     || '—' }   // 11:00 PM
export function fmtClockSec(v)  { return clock12s(v, propertyZone)    || '—' }   // 11:00:07 PM
export function fmtStamp(v)     { return stampShort(v, propertyZone)  || '—' }   // 23 Oct, 11:00 PM
export function fmtStampYear(v) { return stampYear(v, propertyZone)   || '—' }   // 23 Oct 2026, 11:00 PM
export function fmtStampLong(v) { return stampLong(v, propertyZone)   || '—' }   // Fri, 23 Oct 2026, 11:00 PM IST

// The calendar date of a stored moment at the property, 'YYYY-MM-DD' ('' if it is not a moment).
export function stampDate(v) { return dateInZone(v, propertyZone) }

// "IST" - the short name of the property's zone.
export function zoneLabel() { return zoneAbbr(propertyZone) }

// True when the viewer's own clock is not the property's right now (an owner abroad). Screens that
// show a bare time add the zone's name only then, so it is never ambiguous and never noisy.
export function viewerElsewhere() {
  try {
    const mine = new Intl.DateTimeFormat().resolvedOptions().timeZone   // time-ok: the VIEWER's own zone, only to decide whether to name the property's
    if (!mine) return false
    const now = Date.now()
    return offsetMs(now, mine) !== offsetMs(now, propertyZone)
  } catch { return false }
}

// 11:00 PM, or 11:00 PM IST for a viewer who is not on the property's clock.
export function fmtClockZ(v) {
  const t = clock12(v, propertyZone)
  return t ? (viewerElsewhere() ? `${t} ${zoneAbbr(propertyZone)}` : t) : '—'
}

// 23 Oct, 11:00 PM, or ... 11:00 PM IST likewise.
export function fmtStampZ(v) {
  const t = stampShort(v, propertyZone)
  return t ? (viewerElsewhere() ? `${t} ${zoneAbbr(propertyZone)}` : t) : '—'
}
