// THE ONE PLACE THAT KNOWS WHAT TIME IT IS AT THE PROPERTY.
//
// Why this file exists (2026-10-23). The same bug had been fixed three times and came back each time:
// a stored time shown as the raw UTC clock ("Checked in 6:24 AM" for a guest who arrived at 11 PM in
// India). Each fix was a private formatter inside ONE screen (fmtLocalTime in two of them, fmtWhen,
// fmtDateTime, whenShort...), so the next screen made its own raw display and the bug returned.
// Now every stored time and every "today" goes through here, and scripts/check-time.mjs fails the
// build if anything formats one the old way.
//
// Three kinds of value live in the database, and each has exactly one right way to show it:
//   INSTANT        created_at, actual_checkin_at, last_synced_at ...  'YYYY-MM-DD HH:MM:SS' in UTC with
//                  no marker (or an ISO string with Z). Shown in the PROPERTY's zone: clock12, stampShort...
//   CALENDAR DATE  checkin_date, checkout_date, harvest_date ...      'YYYY-MM-DD'. A date, not a moment:
//                  never converted (utils/dates.js fmtDate / parseLocalDate).
//   WALL CLOCK     eta, early_checkin_time, late_checkout_time ...     'HH:MM' as the clock on the villa
//                  wall reads. Never converted (utils/stayTimes.js).
//
// The zone is a setting, not a constant: `timezone` in hosts/<id>/config.js (an IANA name such as
// 'Asia/Kolkata' or 'America/New_York'), served to the app with the rest of the config. A property in
// another country sets its own; one that sets nothing is India's. Everything here takes the zone as
// an argument, because the Worker serves many properties from one process: nothing in this file holds
// "the current zone" (the browser's single-property wrapper is utils/dates.js).
//
// Pure and dependency-free so the Worker, the app and the tests all import the same code. Deliberately
// formats with its own month/day tables instead of Intl's text so the words are identical in every
// engine, and uses standalone functions with their options fixed inside (not fmt(date, options): the
// production minifier has been seen dropping such a second argument, see utils/localWhen.js).

export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── zones ────────────────────────────────────────────────────────────────
const knownZones = new Map()
export function isZone(tz) {
  if (typeof tz !== 'string' || !tz.trim()) return false
  const z = tz.trim()
  if (knownZones.has(z)) return knownZones.get(z)
  let ok = false
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); ok = true } catch { ok = false }
  knownZones.set(z, ok)
  return ok
}

// A usable zone name: the one asked for if the runtime knows it, else India's. A typo in a config
// must not blank every time on the screen.
export function zoneName(tz) {
  return isZone(tz) ? tz.trim() : DEFAULT_TIMEZONE
}

// The zone a tenant's config asks for.
export function zoneOf(config) {
  return zoneName(config && config.timezone)
}

const formatters = new Map()
function partsFormatter(tz) {
  let f = formatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formatters.set(tz, f)
  }
  return f
}

// ── reading a stored value ───────────────────────────────────────────────
const BARE_STAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

// Milliseconds since 1970 for a stored instant, or NaN. D1 keeps UTC with no zone marker, and a bare
// string read by `new Date()` is taken as the DEVICE's local time - which is the whole bug - so a
// marker-less stamp is read as UTC here. A plain calendar date is not an instant and gives NaN.
export function instantMs(value) {
  if (value == null || value === '') return NaN
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const s = String(value).trim()
  if (BARE_STAMP.test(s)) return Date.parse(s.replace(' ', 'T') + 'Z')
  if (CALENDAR_DATE.test(s)) return NaN
  return Date.parse(s)
}

// The wall clock at the property for an instant: { y, mo, d, h, mi, s }, or null.
export function partsInZone(value, tz) {
  const ms = instantMs(value)
  if (!Number.isFinite(ms)) return null
  const o = {}
  for (const p of partsFormatter(zoneName(tz)).formatToParts(new Date(ms))) o[p.type] = p.value
  return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second }
}

const p2 = n => String(n).padStart(2, '0')

// ── dates ────────────────────────────────────────────────────────────────
// The calendar date of an instant at the property, 'YYYY-MM-DD' ('' if it is not a usable instant).
export function dateInZone(value, tz) {
  const p = partsInZone(value, tz)
  return p ? `${p.y}-${p2(p.mo)}-${p2(p.d)}` : ''
}

// Today's date at the property, whatever the phone, the server or the owner's computer says.
export function todayInZone(tz, now = Date.now()) {
  return dateInZone(now, tz)
}

// ── clock ────────────────────────────────────────────────────────────────
// '23:00'
export function clock24(value, tz) {
  const p = partsInZone(value, tz)
  return p ? `${p2(p.h)}:${p2(p.mi)}` : ''
}

// '11:00 PM'
export function clock12(value, tz) {
  const p = partsInZone(value, tz)
  if (!p) return ''
  return `${p.h % 12 || 12}:${p2(p.mi)} ${p.h >= 12 ? 'PM' : 'AM'}`
}

// '11:00:07 PM'
export function clock12s(value, tz) {
  const p = partsInZone(value, tz)
  return p ? `${p.h % 12 || 12}:${p2(p.mi)}:${p2(p.s)} ${p.h >= 12 ? 'PM' : 'AM'}` : ''
}

// '23 Oct, 11:00 PM'
export function stampShort(value, tz) {
  const p = partsInZone(value, tz)
  return p ? `${p.d} ${MONTHS[p.mo - 1]}, ${clock12(value, tz)}` : ''
}

// '23 Oct 2026, 11:00 PM'
export function stampYear(value, tz) {
  const p = partsInZone(value, tz)
  return p ? `${p.d} ${MONTHS[p.mo - 1]} ${p.y}, ${clock12(value, tz)}` : ''
}

// 'Fri, 23 Oct 2026, 11:00 PM IST'
export function stampLong(value, tz) {
  const p = partsInZone(value, tz)
  if (!p) return ''
  const wd = DAYS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()]
  return `${wd}, ${p.d} ${MONTHS[p.mo - 1]} ${p.y}, ${clock12(value, tz)} ${zoneAbbr(tz, instantMs(value))}`
}

// '2026-10-23 23:00:07': the stored shape of a time, read in the zone (for emails and logs that print one)
export function stampSec(value, tz) {
  const p = partsInZone(value, tz)
  return p ? `${p.y}-${p2(p.mo)}-${p2(p.d)} ${p2(p.h)}:${p2(p.mi)}:${p2(p.s)}` : ''
}

// Rewrites every stored-format UTC time inside a piece of text as the same moment in the zone, with the zone's name:
//   '2026-10-23 17:30:07'  /  '2026-10-23 17:30:07 UTC'  /  '2026-10-23T17:30:07.123Z'  ->  '2026-10-23 23:00:07 IST'
// For alert emails, which print times from ~25 places as `${now()}` (a stored UTC time) or an ISO string, and so showed
// the raw UTC clock with no label (the same bug as "Checked in 5:30 PM", 2026-10-24). Done once, in sendAlert, so no
// call site has to remember. Nothing else is touched: a wall-clock '2026-10-28 11:00' (no seconds), a date alone, an
// ISO time with no Z, a time followed by fractions of a second that is not a stored stamp - all stay as written.
export function localiseStamps(text, tz) {
  const s = String(text == null ? '' : text)
  const conv = (ms, original) => (Number.isFinite(ms) ? `${stampSec(ms, tz)} ${zoneAbbr(tz, ms)}` : original)
  return s
    .replace(/\b(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?: UTC)?\b(?!\.\d)/g, (m, d, t) => conv(instantMs(`${d} ${t}`), m))
    .replace(/\b(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z\b/g, (m, d, t) => conv(Date.parse(`${d}T${t}Z`), m))
}

// 'IST', 'CDT', 'GMT+4' - the short name of the zone at that moment.
const NAMES = { 'Asia/Kolkata': 'IST', 'Asia/Calcutta': 'IST' }
export function zoneAbbr(tz, at = Date.now()) {
  const z = zoneName(tz)
  if (NAMES[z]) return NAMES[z]
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'short' })
      .formatToParts(new Date(at)).find(x => x.type === 'timeZoneName')
    return part ? part.value : z
  } catch { return z }
}

// ── the other direction ──────────────────────────────────────────────────
// How far the property's clock is ahead of UTC at that instant, in ms (India: 19,800,000).
export function offsetMs(value, tz) {
  const ms = instantMs(value)
  const p = partsInZone(ms, tz)
  if (!p) return 0
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000
}

// The moment a wall-clock time ('2026-10-23', '23:00') happens at the property, as milliseconds.
// NaN for a date or time that is not one.
export function wallToMs(dateStr, hhmm, tz) {
  const dm = CALENDAR_DATE.exec(String(dateStr || '').slice(0, 10))
  const tm = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '00:00'))
  if (!dm || !tm) return NaN
  const [y, mo, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  const naive = Date.UTC(y, mo - 1, d, +tm[1], +tm[2])
  const first = naive - offsetMs(naive, tz)
  const again = naive - offsetMs(first, tz)       // right across a daylight-saving change
  return again
}

// The stored form of that moment: 'YYYY-MM-DD HH:MM:SS' in UTC, the way every *_at column is written.
export function wallToStamp(dateStr, hhmm, tz) {
  const ms = wallToMs(dateStr, hhmm, tz)
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 19).replace('T', ' ') : ''
}

// An instant as the property's WALL CLOCK read as if it were UTC. For comparing a real stamp with the
// date-and-time strings the database keeps as wall clock (late_checkout_time on checkout_date...):
// both then sit in the same frame, which is what turnaround arithmetic needs.
export function wallMs(value, tz) {
  const p = partsInZone(value, tz)
  return p ? Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) : NaN
}
