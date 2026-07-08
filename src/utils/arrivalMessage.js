// ============================================================
// arrivalMessage.js — "Directions & Steps to Arrival" WhatsApp message
//
// Sent by Raman (host coordinator) to a confirmed guest, typically
// 1-2 days before check-in. Shares booking highlights (no financials),
// the villa location, and simple arrival steps so Raman is on-site
// when the guest arrives. Any change requests are routed to Biji (host).
//
// Used from:
//   - Owner screen: src/screens/villa/CompleteBooking.jsx
//   - Raman's screen: src/screens/villa/CheckIn.jsx
// ============================================================

import { parseLocalDate } from './dates'

const VILLA_MAPS_LINK = 'https://maps.app.goo.gl/fjfe4eS4BJmaHh62A'
const VILLA_FULL_NAME = 'Dvaraka - Luxury Villas of Guruvayur'
const VILLA_ADDRESS   = 'Edappully Gandhinagar Rd, Palayoor, Guruvayur, Kerala 680506, India'
// Host (Biji) WhatsApp — for any change requests only. Guest should NOT contact
// Raman for date/guest-count/request changes, only Biji can approve those.
const HOST_WA_NUMBER  = '+1 972.876.5101'

// Villa facts for the booking-info block. Bedrooms belongs in villa_settings
// once multi-villa lands; constant is fine while Dwarka is the only property.
const VILLA_BEDROOMS  = 4
const CHECKIN_TIME    = 'after 4:00 PM'
const CHECKOUT_TIME   = 'by 11:00 AM'

function fmtLong(d) {
  const parsed = parseLocalDate(d)
  if (!parsed) return null
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Builds the message text (plain, unencoded — for previewing or wa.me encoding).
 * @param {object} stay - a stay/booking record with guest_name, checkin_date,
 *   checkout_date, adults, children, request_early_checkin, request_late_checkout
 */
export function buildArrivalMessage(stay = {}) {
  // Full name in the greeting (matches the owner's established format and
  // avoids 'Namaskaram J!' for initials-style names like 'J S Jagadish Babu')
  const name = (stay.guest_name || '').trim() || 'there'
  const ci = fmtLong(stay.checkin_date)
  const co = fmtLong(stay.checkout_date)
  const adults   = parseInt(stay.adults, 10)   || 1
  const children = parseInt(stay.children, 10) || 0
  const totalGuests = adults + children
  const breakdown = children > 0 ? ` (${adults} adult${adults !== 1 ? 's' : ''} + ${children} child${children !== 1 ? 'ren' : ''})` : ''

  // Nights: prefer stored value, else derive from the dates
  let nights = parseInt(stay.nights, 10) || 0
  if (!nights) {
    const a = parseLocalDate(stay.checkin_date), b = parseLocalDate(stay.checkout_date)
    if (a && b) nights = Math.max(1, Math.round((b - a) / 86400000))
  }

  // If an early check-in / late check-out was requested, the fixed times are
  // shown as "as agreed" so the critical-timing note stays truthful.
  const ciTime = stay.request_early_checkin ? 'early check-in as agreed \u23F0' : CHECKIN_TIME
  const coTime = stay.request_late_checkout ? 'late check-out as agreed \uD83C\uDF19' : CHECKOUT_TIME

  const lines = [
    `Namaskaram ${name}! \uD83D\uDE4F`,
    ``,
    `This is Raman, your host coordinator. Hearty welcome \u2014 looking forward to hosting your family at ${VILLA_FULL_NAME}, Kerala, India! \u2705`,
    ``,
    `Please review your booking info:`,
    ``,
    `\u2022 Max guest count: ${totalGuests} guest${totalGuests !== 1 ? 's' : ''}${breakdown} \u2014 count validated at check-in`,
    `\u2022 Bedrooms: ${VILLA_BEDROOMS} bedrooms [Standard Indian Queen size beds]`,
    `\u2022 Nights of stay: ${nights || '\u2014'}`,
    `\u2022 Check-in: ${ci || '\u2014'} \u2014 ${ciTime}`,
    `\u2022 Check-out: ${co || '\u2014'} \u2014 ${coTime}`,
    ``,
    `\u23F0 IMPORTANT: please keep a close watch on the check-in and check-out times above. Unless a different time has been agreed with us in advance, these timings are critical \u2014 the next guest's arrival and the villa's preparation are planned around them.`,
    ``,
    `\uD83D\uDCCD Location: ${VILLA_MAPS_LINK}`,
    VILLA_ADDRESS,
    ``,
    `A couple of things so I'm ready and waiting for you at the gate:`,
    `1\uFE0F\u20E3 Please message me on this number about 1 hour before you reach Guruvayur.`,
    `2\uFE0F\u20E3 I'll be at the villa to welcome you and help with check-in \u2014 same at check-out, just give me a heads-up on your departure time.`,
    ``,
    `Note: any changes to your booking (dates, guest count, or requests) need to be approved directly by our host Biji \u2014 please reach out on WhatsApp at ${HOST_WA_NUMBER}.`,
    ``,
    `Looking forward to hosting you! \uD83C\uDFE1`,
  ]

  return lines.join('\n')
}

/**
 * Builds a wa.me deep-link (pre-filled, not auto-sent) that opens the guest's
 * chat with the message ready to send. Returns null if no phone is on file.
 */
export function buildArrivalWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const raw = String(phone).replace(/\D/g, '')
  const num = raw.startsWith('91') ? raw : (raw.length === 10 ? `91${raw}` : raw)
  const msg = encodeURIComponent(buildArrivalMessage(stay))
  return `https://wa.me/${num}?text=${msg}`
}
