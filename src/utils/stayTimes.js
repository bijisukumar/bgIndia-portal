// When a guest is due in and out — worked out in ONE place, so the owner's
// Complete booking screen, Raman's screens, the home screen's approval block and
// the WhatsApp messages can never disagree about it.
//
// Where the pieces come from (nothing here needs a column of its own except the
// guest's expected departure):
//   standard   the villa's own times (hosts/<id>/config.js: 4:00 PM / 11:00 AM)
//   agreed     early_checkin_time / late_checkout_time — a time the owner agreed
//              with this guest, set in Complete booking or by approving what the
//              guest asked for
//   guest      eta (arrival) and etd (expected departure): what the guest typed on
//              the online check-in form. A statement of intent, not an agreement.
//   (expected_arrival_at / expected_departure_at are the owner's recorded
//   exceptions for the turnaround logic and the manager's commission; they are
//   deliberately not read or written here.)
//
// The EFFECTIVE time is the agreed one if there is one, else the standard. A
// guest's time needs the owner's decision only when it asks for more than the
// effective time gives: arriving before check-in, or leaving after check-out.
// (Arriving later, or leaving earlier, is just information.) It stays FLAGGED
// until the stay is marked ready for check-in — by then the owner has either
// approved it (it became the agreed time, so there is nothing left to ask for) or
// declined it (Decline records that, see `timeAsks` below, and the flag goes), and
// the guest's wish remains visible as a plain note, now marked declined.
//
// Pure functions with their options fixed inside — deliberately not the
// fmtDate(date, options) shape: the production minifier has been seen dropping a
// helper's second argument (see CompleteBooking and localWhen.js).

// Statuses before "ready for check-in": the owner can still act on what a guest asked.
const REVIEW_OPEN = new Set(['booked', 'confirmed', 'pending_review', 'docs_uploaded'])
// Statuses before the guest has arrived (a ready guest is still to arrive).
export const PRE_ARRIVAL_STATUSES = ['booked', 'confirmed', 'pending_review', 'docs_uploaded', 'ready_for_checkin']

// Accepts '16:00', '16:00:00', '4:00 PM', '4 PM'. Returns minutes past midnight,
// or null for anything else (older forms let guests type free text).
export function toMinutes(t) {
  if (t === null || t === undefined) return null
  const m = String(t).trim().match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] === undefined ? 0 : parseInt(m[2], 10)
  const suffix = (m[3] || '').toLowerCase()
  if (min > 59) return null
  if (suffix) {
    if (h < 1 || h > 12) return null
    if (suffix === 'pm' && h !== 12) h += 12
    if (suffix === 'am' && h === 12) h = 0
  } else if (h > 23) {
    return null
  }
  return h * 60 + min
}

// '16:00' -> '4:00 PM'. A value that is not a clean time (a guest typed
// "around 3") is shown as typed rather than hidden: somebody should read it.
export function fmtTime(t) {
  const mins = toMinutes(t)
  if (mins === null) return t ? String(t).trim() : ''
  const h24 = Math.floor(mins / 60)
  const m = mins % 60
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`
}

// Rows arrive snake_case (getUpcomingStays) or camelCase (Raman's to-do and the
// approval block); read either, the same way.
function field(stay, snake, camel) {
  const a = stay[snake]
  if (a !== undefined && a !== null && a !== '') return a
  const b = stay[camel]
  return b === undefined || b === null ? '' : b
}

// What became of the times a guest asked for. The server attaches `timeAsks` to a stay row: each decision about the arrival or
// departure the guest typed, oldest first, as { kind: 'arrival' | 'departure', time: 'HH:MM',
// decision: 'declined' | 'approved' | 'agreed' | 'cleared', by, reason, at }. (The Worker keeps them in infra_processing_log,
// event 'guest_time': nothing about them lives on the stay itself.) Only the newest decision about THE SAME clock time counts: a
// guest who later asks for a different time is asking again, and an agreed time the owner takes back opens the ask again.
function askList(stay) {
  const a = stay && stay.timeAsks
  return Array.isArray(a) ? a.filter(e => e && typeof e === 'object') : []
}
function lastDecision(stay, kind, askedMin) {
  if (askedMin === null) return null
  let found = null
  for (const e of askList(stay)) if (e.kind === kind && toMinutes(e.time) === askedMin) found = e
  return found
}

// One decision in words, for the history on Guest info and on Raman's screens (the date is the screen's: it knows the zone).
//   { icon, text, tone: 'bad' | 'good' | 'dim', reason }     'Early check-in 2:00 PM — declined by Owner'
export function askWords(e) {
  const x = e || {}
  const what = x.kind === 'departure' ? 'Late check-out' : 'Early check-in'
  const time = fmtTime(x.time)
  const by = String(x.by || '').replace(/^staff-/, '').split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const who = by ? ` by ${by}` : ''
  const reason = String(x.reason || '').trim()
  switch (x.decision) {
    case 'declined': return { icon: '🚫', text: `${what} ${time} — declined${who}`, tone: 'bad', reason }
    case 'approved': return { icon: '✅', text: `${what} ${time} — approved${who}`, tone: 'good', reason }
    case 'agreed':   return { icon: '✅', text: `${what} ${time} — agreed${who}`, tone: 'good', reason }
    case 'cleared':  return { icon: '↩️', text: `${what} ${time} — taken back${who}`, tone: 'dim', reason }
    // The guest's own time was typed over (the owner edited the ETA): the ask is kept, and what it became is in the words.
    case 'changed':  return { icon: '✏️', text: `${what} ${time} — asked; ${reason || "the guest's time was changed"}${who}`, tone: 'dim', reason: '' }
    default:         return { icon: '•', text: `${what} ${time}`, tone: 'dim', reason }
  }
}

// defaults: { checkin: '4:00 PM', checkout: '11:00 AM' } — the villa's standard times.
export function stayTimes(stay, defaults) {
  const s = stay || {}
  const d = defaults || {}
  const stdIn  = d.checkin  || '4:00 PM'
  const stdOut = d.checkout || '11:00 AM'

  const agreedIn  = field(s, 'early_checkin_time', 'earlyCheckinTime')
  const agreedOut = field(s, 'late_checkout_time', 'lateCheckoutTime')
  const eta       = field(s, 'eta', 'eta')
  const etd       = field(s, 'etd', 'etd')
  const reqEarly  = !!field(s, 'request_early_checkin', 'requestEarlyCheckin')
  const reqLate   = !!field(s, 'request_late_checkout', 'requestLateCheckout')
  const status    = String(s.status || '').trim().toLowerCase()
  // No status on the row (a caller that has not selected it) means "still open".
  const reviewOpen = status ? REVIEW_OPEN.has(status) : true

  const effIn  = toMinutes(agreedIn)  !== null ? toMinutes(agreedIn)  : toMinutes(stdIn)
  const effOut = toMinutes(agreedOut) !== null ? toMinutes(agreedOut) : toMinutes(stdOut)
  const etaMin = toMinutes(eta)
  const etdMin = toMinutes(etd)

  // The guest wants more than the effective time gives (a fact about the data,
  // true whatever the stay's status).
  const etaBeforeCheckin = etaMin !== null && effIn  !== null && etaMin < effIn
  const etdAfterCheckout = etdMin !== null && effOut !== null && etdMin > effOut

  // The owner has already said no to exactly this time (see askList above): that is settled, not waiting for a decision.
  const askIn  = lastDecision(s, 'arrival',   etaMin)
  const askOut = lastDecision(s, 'departure', etdMin)
  const inDeclined  = etaBeforeCheckin && !!askIn  && askIn.decision  === 'declined'
  const outDeclined = etdAfterCheckout && !!askOut && askOut.decision === 'declined'

  const arrivalFlag   = etaBeforeCheckin && reviewOpen && !inDeclined
  const departureFlag = etdAfterCheckout && reviewOpen && !outDeclined

  // An agreed time only counts as "early" / "late" if it really is before the
  // standard check-in / after the standard check-out.
  const stdInMin  = toMinutes(stdIn)
  const stdOutMin = toMinutes(stdOut)
  const inEarly  = toMinutes(agreedIn)  !== null && stdInMin  !== null && toMinutes(agreedIn)  < stdInMin
  const outLate  = toMinutes(agreedOut) !== null && stdOutMin !== null && toMinutes(agreedOut) > stdOutMin

  return {
    inTime:  agreedIn  ? fmtTime(agreedIn)  : fmtTime(stdIn),
    outTime: agreedOut ? fmtTime(agreedOut) : fmtTime(stdOut),
    stdIn: fmtTime(stdIn), stdOut: fmtTime(stdOut),
    inAgreed: !!agreedIn, outAgreed: !!agreedOut,
    inEarly, outLate,
    // A request with no agreed time still matters: a conversation is open. Not once the owner has said no to it.
    inPending:  reqEarly && !agreedIn  && !inDeclined,
    outPending: reqLate  && !agreedOut && !outDeclined,
    eta: fmtTime(eta), etd: fmtTime(etd),
    // The values the approve buttons would write, only when they are clean clock times.
    etaClock: etaMin !== null, etdClock: etdMin !== null,
    etaBeforeCheckin, etdAfterCheckout,
    reviewOpen,
    arrivalFlag, departureFlag,
    needsReview: arrivalFlag || departureFlag,
    // The owner turned down the time the guest asked for (the guest's own time stays as they typed it), and that decision.
    inDeclined, outDeclined,
    declinedIn: inDeclined ? askIn : null, declinedOut: outDeclined ? askOut : null,
    // Every decision made about this stay's times, oldest first, with the clock time spelled out.
    asks: askList(s).map(e => ({ ...e, timeLabel: fmtTime(e.time) })),
  }
}

// What to say to the GUEST about their own times in a WhatsApp message. Only a
// time that is consistent with what the villa can give is repeated back: a guest
// who typed an arrival before check-in, or a departure after check-out, that the
// owner has not agreed to must not be answered with the time they asked for as if
// it had been granted. (Once the owner approves, it becomes the agreed time and is
// the effective one.) Returns '' for each part when there is nothing to add.
export function guestFacingTimes(stay, defaults) {
  const t = stayTimes(stay, defaults)
  const arrival   = t.eta && !t.etaBeforeCheckin ? `your expected arrival: ${t.eta}` : ''
  const departure = t.etd && !t.etdAfterCheckout ? `your planned departure: ${t.etd}` : ''
  return { ...t, arrivalNote: arrival, departureNote: departure }
}

// '4:00 PM' or '16:00:00' -> '16:00', the shape <input type="time"> wants. '' when
// the value is not a clock time (a guest typed "around 3"), so a screen never shows
// a time it cannot read.
export function toClock(t) {
  const m = toMinutes(t)
  return m === null ? '' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

// Extra-charge lines are free-form { label, amount }, so an early check-in and/or a
// late check-out charge is recognised by its label ("Early Check-in", "Late
// Check-out", "Early Check-in + Late Check-out").
export function feeLineKind(label) {
  const s = String(label || '')
  return { early: /early\s*check[\s-]*in/i.test(s), late: /late\s*check[\s-]*out/i.test(s) }
}

// What the checkout-day email says about check-out: the standard time and, for a guest
// with an agreed later one, theirs too: "11:00 AM (yours is 6:00 PM, as agreed)". It
// slots into the template's "Standard check-out time is {checkoutTime}".
export function checkoutTimeNote(standard, agreed) {
  const std = toMinutes(standard), late = toMinutes(agreed)
  if (std === null || late === null || late <= std) return standard
  return `${standard} (yours is ${fmtTime(agreed)}, as agreed)`
}
