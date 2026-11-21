// ============================================================
//  sameDayTurnover.js: which stays on a list meet on the same day, one guest leaving as another arrives.
//
//  On such a day the villa has hours, not a night, to be cleaned and reset. Raman's home screen has always had a box for it on his next
//  arrivals; the owner's guest list (Complete booking, "Select guest") had nothing, so a guest leaving at 11:00 AM and the next one arriving at
//  4:00 PM looked like two unrelated rows (28 Nov 2026: Ayyappadas out, Alvin in). This is the rule for those lists, and for Raman's check-in
//  screen and the banner of the guest in the house on his home screen: it flags BOTH stays.
//
//  Pure: a screen gives it the rows it already holds (getUpcomingStays, snake_case), the villa's standard times and its turnaround hours
//  (src/utils/villaTimes.js). Nothing here reads a clock, a zone or the database.
//
//  A pair is one stay that checks OUT on the day another checks IN, in the same property, neither cancelled, void or closed. It is flagged
//  only while it can still matter: the leaving guest has not checked out yet, and the arriving guest has not arrived yet. (A guest who has
//  left, or arrived, is no longer a turnover to prepare for.) The hours between are worked out from the times the guests were PROMISED: an
//  agreed late check-out / early check-in when there is one, else the villa's standard times (what stayTimes() calls the effective ones), the
//  same figures Raman's box uses. What a guest merely typed on the form (an ETA) is not an agreement and is not counted here.
// ============================================================
import { stayTimes, toMinutes, PRE_ARRIVAL_STATUSES } from './stayTimes.js'

const GONE = new Set(['cancelled', 'void', 'closed'])
const status = s => String((s && s.status) || '').trim().toLowerCase()
const day = v => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '')
// One visit, however many rows record it (the booking and the guest's own check-in form, not merged yet): same name, same dates.
const visit = s => `${String(s.guest_name || '').trim().toLowerCase()}|${day(s.checkin_date)}|${day(s.checkout_date)}`
// Either spelling of a row's field: the owner's list and Raman's check-in screen are snake_case, Raman's home screen camelCase.
const pick = (s, snake, camel) => {
  const a = s && s[snake]
  if (a !== undefined && a !== null && a !== '') return a
  const b = s && s[camel]
  return b === undefined || b === null ? '' : b
}

// The facts of ONE pair, for a screen that already knows who leaves and who arrives (Raman's home banner). `leaving` and `arriving` are stay rows
// in either spelling; the day is the arriving guest's check-in date. -> the item sameDayTurnovers() lists (the caller adds `role`).
//    date      the day it happens, 'YYYY-MM-DD'
//    leaving   { stayId, guestName } of the guest who leaves;  arriving: the same for the guest who arrives
//    outTime / inTime   '11:00 AM' / '4:00 PM': the leaving guest's check-out and the arriving guest's check-in, as promised
//    gapMinutes  inTime minus outTime (negative = the two overlap); null when a time is not a clock time
//    tight       the gap is shorter than the villa's turnaround hours (an overlap is always tight)
export function turnoverItem(leaving, arriving, defaults, turnaroundHours) {
  const hours = Number(turnaroundHours) > 0 ? Number(turnaroundHours) : 6
  const outTime = stayTimes(leaving, defaults).outTime
  const inTime = stayTimes(arriving, defaults).inTime
  const outMin = toMinutes(outTime), inMin = toMinutes(inTime)
  const gapMinutes = outMin !== null && inMin !== null ? inMin - outMin : null
  return {
    date: day(pick(arriving, 'checkin_date', 'checkInDate')), outTime, inTime, gapMinutes, turnaroundHours: hours,
    tight: gapMinutes !== null && gapMinutes < hours * 60,
    leaving: { stayId: pick(leaving, 'stay_id', 'stayId'), guestName: pick(leaving, 'guest_name', 'guestName') },
    arriving: { stayId: pick(arriving, 'stay_id', 'stayId'), guestName: pick(arriving, 'guest_name', 'guestName') },
  }
}

// stays: the list's rows (snake_case). defaults: { checkin, checkout }, the villa's standard times. turnaroundHours: the villa's own number (6 when it
// has none). -> { [stay_id]: [ { role, ...turnoverItem } ] }, role 'out' on the row of the guest who leaves that day, 'in' on the row of the guest
// who arrives. A stay with no flag is simply not a key. A row never lists the same visit twice.
export function sameDayTurnovers(stays, defaults, turnaroundHours) {
  const rows = (Array.isArray(stays) ? stays : []).filter(s => s && s.stay_id && !GONE.has(status(s)))
  const leavingOn = new Map()   // day -> the stays that check out that day
  for (const s of rows) {
    const out = day(s.checkout_date), inn = day(s.checkin_date)
    if (!out || !inn || out <= inn) continue   // dates that make no stay (no nights) are nobody's turnover
    if (!leavingOn.has(out)) leavingOn.set(out, [])
    leavingOn.get(out).push(s)
  }
  const result = {}
  const keys = {}
  const add = (id, key, item) => {
    if (!keys[id]) keys[id] = new Set()
    if (keys[id].has(key)) return
    keys[id].add(key)
    ;(result[id] = result[id] || []).push(item)
  }
  for (const arriving of rows) {
    const date = day(arriving.checkin_date)
    if (!date || !PRE_ARRIVAL_STATUSES.includes(status(arriving))) continue   // already here (or done): nothing left to prepare for
    for (const leaving of leavingOn.get(date) || []) {
      if (leaving.stay_id === arriving.stay_id) continue
      if (status(leaving) === 'checked_out') continue                           // already gone: the villa is being reset, not waiting
      if (leaving.villa_id && arriving.villa_id && leaving.villa_id !== arriving.villa_id) continue
      const item = turnoverItem(leaving, arriving, defaults, turnaroundHours)
      const key = visit(leaving) + '>' + visit(arriving)
      add(arriving.stay_id, key, { ...item, role: 'in' })
      add(leaving.stay_id, key, { ...item, role: 'out' })
    }
  }
  return result
}

// 300 -> '5 hrs', 270 -> '4h 30m', 60 -> '1 hr', 45 -> '45 min'. The size of a gap, whichever way round (an overlap is said by the caller).
export function gapWords(minutes) {
  if (minutes === null || minutes === undefined || !Number.isFinite(Number(minutes))) return ''
  const a = Math.abs(Math.round(Number(minutes)))
  const h = Math.floor(a / 60), m = a % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} hr${h === 1 ? '' : 's'}` : `${h}h ${m}m`
}
