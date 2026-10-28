// Check-in date sanity (2026-10-23, after Raman checked in a guest booked for the NEXT day and the wrong
// check-outs that followed). A guest may arrive ON the booked date or AFTER it (past midnight, or simply
// late); one booked for a LATER date is almost always the wrong guest picked from a list. The villa's
// dates are the property's own, so "today" is the property's date whatever the phone or the owner's computer
// says: the caller passes it (localTodayStr() in the app, todayInZone(zone) in the Worker; utils/tz.js), so
// nothing here knows a time zone. Pure, so the Worker imports it too.

// 'early'  booked for a later date than today: needs a deliberate yes
// 'today'  the booked date
// 'late'   arriving after the booked date (past midnight, or late): fine
// 'unknown' the stay has no usable check-in date (or no "today" was given)
export function checkinDateStatus(checkinDate, today) {
  const d = String(checkinDate || '').slice(0, 10)
  const t = String(today || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return 'unknown'
  return d > t ? 'early' : d === t ? 'today' : 'late'
}

// How many days AHEAD of today the booked date is: 0 when it is today or already past, null when either date is unusable.
export function daysEarly(checkinDate, today) {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(checkinDate || ''))
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(today || ''))
  if (!a || !b) return null
  return Math.max(0, Math.round((Date.UTC(+a[1], +a[2] - 1, +a[3]) - Date.UTC(+b[1], +b[2] - 1, +b[3])) / 86400000))
}

// The most days early the MANAGER can check a guest in at all. A day early happens (a family that arrives overnight); two or more is a
// wrong guest or a wrong date, and the owner settles that first by changing the booking's date. 2026-10-28: a guest booked for the 30th
// was checked in on the 28th, 26 seconds after the right guest, by tapping through the red "check in anyway" step.
export const MAX_DAYS_EARLY = 1
