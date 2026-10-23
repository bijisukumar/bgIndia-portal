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
