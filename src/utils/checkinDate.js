// Check-in date sanity (2026-10-23, after Raman checked in a guest booked for the NEXT day and the wrong
// check-outs that followed). A guest may arrive ON the booked date or AFTER it (past midnight, or simply
// late); one booked for a LATER date is almost always the wrong guest picked from a list. The villa's
// dates are India's, so "today" is India's date whatever the phone or the owner's computer says. Pure, so
// the Worker imports it too.

const IST_OFFSET_MS = 5.5 * 3600 * 1000

// Today's date in India, YYYY-MM-DD.
export function istToday(now = Date.now()) {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10)
}

// 'early'  booked for a later date than today: needs a deliberate yes
// 'today'  the booked date
// 'late'   arriving after the booked date (past midnight, or late): fine
// 'unknown' the stay has no usable check-in date
export function checkinDateStatus(checkinDate, today = istToday()) {
  const d = String(checkinDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 'unknown'
  return d > today ? 'early' : d === today ? 'today' : 'late'
}
