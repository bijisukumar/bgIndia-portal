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

export function daysFromToday(d) {
  const a = parseLocalDate(d)
  if (!a) return null
  const today = new Date()
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((a - todayLocal) / 86400000)
}

// "Today" as a YYYY-MM-DD string in the *browser's local* calendar date.
// `new Date().toISOString().slice(0,10)` is a common but subtly wrong way to
// get this — toISOString() converts to UTC first, so for any viewer in a
// timezone behind UTC (IST included), it returns yesterday's date for roughly
// the first several hours of each local day. Use this instead anywhere a
// date input or "today" constant needs to default to the current local date.
export function localTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

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
