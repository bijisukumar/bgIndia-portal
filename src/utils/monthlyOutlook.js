// The "Projected income" block on the owner dashboard (Financials, at the top) and the Marketing tab's "Plan ahead": small pure helpers, so
// the screens and the tests read a month the same way. The figures come from the Worker's getMonthlyOutlook, one object per month:
//   { ym, year, month, current, days, bookings, nights, gross, net, direct, occupied, closed, open,
//     lastYear: { bookings, nights, gross, net } }
// bookings / nights / gross / net are what the Financials tab shows for that month (a stay counts in the month it checks in). The owner's
// INCOME is `net`: what is left after the platform's commission (what reaches the bank), before staff commission and expenses; `gross` is
// before the commission. occupied / closed / open are NIGHTS of the month: held by a stay, closed (blocked or held for an agreed time),
// still open to sell from today. Bookings in hand, not a forecast.
//
// Pure: no clock, no config.

// "₹80,000": whole rupees in the Indian digit grouping, for the figures an owner reads as cash.
export function rupees(n) {
  const v = Math.round(Number(n) || 0)
  return (v < 0 ? '-' : '') + '₹' + Math.abs(v).toLocaleString('en-IN')
}

// How a month's income stands against the same month a year ago: by money when that month brought in an income, by nights when it has no
// amounts recorded (older bookings imported without a price). kind: 'ahead' | 'level' | 'short' | 'none'; by: how much (never negative);
// unit: 'money' | 'nights'. 'none' = nothing was booked in that month last year, so there is nothing to compare with.
export function againstLastYear(m) {
  const ly = (m && m.lastYear) || {}
  if (Number(ly.net) > 0) return verdict((Number(m && m.net) || 0) - Number(ly.net), 'money')
  if (Number(ly.nights) > 0) return verdict((Number(m && m.nights) || 0) - Number(ly.nights), 'nights')
  return { kind: 'none', by: 0, unit: 'money' }
}

function verdict(diff, unit) {
  const d = Math.round(diff)
  if (d > 0) return { kind: 'ahead', by: d, unit }
  if (d < 0) return { kind: 'short', by: -d, unit }
  return { kind: 'level', by: 0, unit }
}

// How full the month is, 0 to 100: the nights a stay holds over the days in the month.
export function bookedShare(m) {
  const days = Number(m && m.days) || 0
  if (days <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((100 * (Number(m.occupied) || 0)) / days)))
}

// The line above the months: everything coming in across them, and what the same months brought in last year.
export function outlookTotals(months) {
  const t = { bookings: 0, nights: 0, gross: 0, net: 0, open: 0, lastYearNet: 0 }
  for (const m of months || []) {
    t.bookings += Number(m && m.bookings) || 0
    t.nights += Number(m && m.nights) || 0
    t.gross += Number(m && m.gross) || 0
    t.net += Number(m && m.net) || 0
    t.open += Number(m && m.open) || 0
    t.lastYearNet += Number(m && m.lastYear && m.lastYear.net) || 0
  }
  return t
}

// The year buttons, newest first: this year and `back` years before it, plus every LATER year that already has a booking (a booking
// for 2027 must give a 2027 button). Only `ahead` years on from this one count, so a mistyped date cannot make a button.
// `stays`: rows whose check-in date is checkIn, checkInDate or checkin_date (cancelled and void stays are not in the list).
export function yearChoices(stays, thisYear, back = 5, ahead = 3) {
  let top = thisYear
  for (const s of stays || []) {
    const y = parseInt(String((s && (s.checkIn || s.checkInDate || s.checkin_date)) || '').slice(0, 4), 10)
    if (y > top && y <= thisYear + ahead) top = y
  }
  const out = []
  for (let y = top; y >= thisYear - back; y--) out.push(y)
  return out
}
