// Nights taken out of sale by an agreed early check-in or late check-out.
//
// A guest who leaves at 6 PM on the 12th is still in the villa when the next
// family would want to arrive at 4 PM that day, and nobody can be turned
// round in the hours that are left. So the night of the 12th is not for sale,
// even though no booking covers it: the villa's own policy is that it
// "holds the adjoining night" for a late check-out (and, the other way round,
// for an early check-in the night BEFORE). Dates alone cannot see this, which
// is how a booking that should have been refused used to look available.
//
// ONE rule, used by everything that decides whether a night is free — the
// calendar grid, the calendars handed to the booking platforms, the
// enquiry screen's availability check and the home screen's "gaps" — so they
// cannot disagree. It runs on the server (functions/api/[[route]].js) and is
// pure, so the screens can show the same answer.
//
// A hold exists only for a time the owner has AGREED (early_checkin_time /
// late_checkout_time). What a guest merely typed on the check-in form holds
// nothing until it is approved.
//
//   late check-out holds the night of the check-out date when the agreed time
//     is later than the standard check-out AND leaves fewer than
//     `turnaroundHours` before the standard check-in;
//   early check-in holds the night BEFORE the check-in date when the agreed
//     time is earlier than the standard check-in AND comes fewer than
//     `turnaroundHours` after the standard check-out.
//
// rules: { stdIn: '16:00', stdOut: '11:00', turnaroundHours: 6 } — the villa's
// standard times (either 24h or '4:00 PM' form) and the hours it needs between a
// departure and the next arrival (stayvibe_villa_settings 'turnaround_hours').
import { toMinutes, fmtTime } from './stayTimes.js'

export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function stayHolds(stay, rules) {
  const s = stay || {}
  const r = rules || {}
  const stdIn  = toMinutes(r.stdIn  || '16:00')
  const stdOut = toMinutes(r.stdOut || '11:00')
  const hours  = r.turnaroundHours > 0 ? r.turnaroundHours : 6
  const need   = hours * 60
  if (stdIn === null || stdOut === null) return []

  const stayId   = s.stay_id || s.stayId || null
  const checkin  = s.checkin_date  || s.checkIn  || ''
  const checkout = s.checkout_date || s.checkOut || ''
  const late  = toMinutes(s.late_checkout_time !== undefined && s.late_checkout_time !== null ? s.late_checkout_time : s.lateCheckoutTime)
  const early = toMinutes(s.early_checkin_time !== undefined && s.early_checkin_time !== null ? s.early_checkin_time : s.earlyCheckinTime)

  const holds = []
  if (checkout && late !== null && late > stdOut && stdIn - late < need) {
    holds.push({ kind: 'late_checkout', night: checkout, time: clock(late), stayId })
  }
  if (checkin && early !== null && early < stdIn && early - stdOut < need) {
    holds.push({ kind: 'early_checkin', night: addDays(checkin, -1), time: clock(early), stayId })
  }
  return holds
}

// minutes after midnight -> '18:00' (whatever form the time was stored in)
function clock(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0')
}

// "late check-out until 6:00 PM" / "early check-in at 11:00 AM"
export function holdPhrase(hold) {
  return hold.kind === 'late_checkout'
    ? `late check-out until ${fmtTime(hold.time)}`
    : `early check-in at ${fmtTime(hold.time)}`
}

// '2026-10-12' -> '12 Oct'. A fixed format with no options argument, on purpose:
// the production minifier has been seen dropping a helper's second argument.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function dayMonth(date) {
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10) - 1]}` : String(date || '')
}

// For a toast, once a time has been agreed: ' — night of 12 Oct now closed to new
// bookings', or '' when it holds nothing.
export function heldSummary(holds) {
  const nights = (holds || []).slice().sort((a, b) => (a.night < b.night ? -1 : a.night > b.night ? 1 : 0)).map(h => dayMonth(h.night))
  if (!nights.length) return ''
  return ` — ${nights.length > 1 ? 'nights' : 'night'} of ${nights.join(' & ')} now closed to new bookings`
}
