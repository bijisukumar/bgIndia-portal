// ============================================================
//  THE EARLY CHECK-IN / LATE CHECK-OUT A QUOTE OFFERS, AND HOW THE QUOTE WORDS IT
//
//  On an enquiry, "Early Check-in", "Late Check-out" and "Early Check-in + Late Check-out" are extra-charge lines (EXTRA_ITEMS), and each can
//  carry the time the guest asked for (earlyCheckinTime / lateCheckoutTime, "HH:MM", from the Arrival time / Departure time boxes under the
//  line). The quote used to print only the label and the fee, so the message in the chat said "+ Early Check-in: ₹8,154" with no hour, and nobody
//  could tell later what had been offered. Now the hour is written wherever the early or late time comes up (Biji, 23 Nov 2026):
//
//      Check-in: 1 Apr 2027 (early check-in from 12:00 PM; standard is after 4:00 PM)
//      Check-out: 2 Apr 2027 (late check-out until 3:00 PM; standard is by 11:00 AM)
//      + Early Check-in (from 12:00 PM): ₹8,154
//
//  A complimentary early or late time (a line at ₹0) has no fee line but still changes the time, so the two dates lines say it. A line with no
//  time entered is worded as before (the screen asks for the time). Pure functions; the Worker reads the same times from the same lines when the
//  enquiry is confirmed into a booking (extractRequestedTimesFromExtraLines).
// ============================================================
import { fmtTime } from './stayTimes.js'

// The times asked for across ALL of a quote's lines (a ₹0 line counts). The last one written wins, as when the enquiry becomes a booking.
// -> { early: 'HH:MM' | '', late: 'HH:MM' | '' }
export function quoteTimes(lines) {
  let early = '', late = ''
  for (const l of Array.isArray(lines) ? lines : []) {
    if (l && l.earlyCheckinTime) early = String(l.earlyCheckinTime)
    if (l && l.lateCheckoutTime) late = String(l.lateCheckoutTime)
  }
  return { early, late }
}

// One extra line's label with the hour it was asked for: "Early Check-in (from 12:00 PM)", "Late Check-out (until 3:00 PM)", and for the
// combined item "Early Check-in + Late Check-out (check-in from 12:00 PM, check-out until 3:00 PM)". Any other line, or one with no time, is
// returned as it is.
export function labelWithTimes(line) {
  const label = String((line && line.label) || '')
  const early = label.includes('Early Check-in'), late = label.includes('Late Check-out')
  const inT = early ? fmtTime(line.earlyCheckinTime) : '', outT = late ? fmtTime(line.lateCheckoutTime) : ''
  const parts = []
  if (inT) parts.push(late ? `check-in from ${inT}` : `from ${inT}`)
  if (outT) parts.push(early ? `check-out until ${outT}` : `until ${outT}`)
  return parts.length ? `${label} (${parts.join(', ')})` : label
}

// The words inside the brackets of the quote's two dates lines. std = the villa's standard times as text ({ checkinTime: '4:00 PM', checkoutTime: '11:00 AM' }).
// -> { inNote, outNote }, e.g. "early check-in from 12:00 PM; standard is after 4:00 PM" or, with nothing asked, "after 4:00 PM".
export function dateNotes(times, std) {
  const t = times || {}
  const s = std || {}
  return {
    inNote: t.early ? `early check-in from ${fmtTime(t.early)}; standard is after ${s.checkinTime}` : `after ${s.checkinTime}`,
    outNote: t.late ? `late check-out until ${fmtTime(t.late)}; standard is by ${s.checkoutTime}` : `by ${s.checkoutTime}`,
  }
}
