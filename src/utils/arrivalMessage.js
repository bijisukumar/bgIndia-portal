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

import { CONFIG } from '../config'
import { parseLocalDate } from './dates'

// Villa facts for the booking-info block, sourced from the per-host config
// (hosts/<hostId>/config.js). Constant lookup here is fine while Dwarka is
// the only property; multi-villa selection is a separate, later concern.
const villa = CONFIG.villas[0]
const VILLA_MAPS_LINK = villa.mapsLink
const VILLA_FULL_NAME = villa.arrivalFullName
const VILLA_ADDRESS   = villa.address
// Host (Biji) WhatsApp — for any change requests only. Guest should NOT contact
// Raman for date/guest-count/request changes, only Biji can approve those.
const HOST_WA_NUMBER  = CONFIG.ownerWhatsApp
const VILLA_BEDROOMS  = villa.bedrooms
const MANAGER_NAME    = villa.managerName
const MANAGER_PHONE   = villa.managerPhone

// NOT sourced from CONFIG: these already duplicate tenants.checkin_time /
// checkout_time (D1, served via the getTenantConfig worker action) used by
// GuestFormScript.gs. Reconciling this file to read the live tenant value
// would mean making message-building async; left as a known follow-up.
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
 * @param {object} opts - { senderRole: 'raman' | 'owner' }. 'raman' (default)
 *   keeps the message written in Raman's own voice, for when he sends it
 *   himself from his own WhatsApp. 'owner' is for when Biji sends it instead —
 *   the message can't pretend to be Raman texting, so it introduces him and
 *   gives the guest his direct number instead of a bare "message me."
 */
export function buildArrivalMessage(stay = {}, opts = {}) {
  const senderRole = opts.senderRole === 'owner' ? 'owner' : 'raman'
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

  const intro = senderRole === 'owner'
    ? `Hearty welcome \u2014 looking forward to hosting your family at ${VILLA_FULL_NAME}, Kerala, India! \u2705`
    : `This is Raman, your host coordinator. Hearty welcome \u2014 looking forward to hosting your family at ${VILLA_FULL_NAME}, Kerala, India! \u2705`

  // The "call ahead" instruction is the one thing that actually prevents a bad
  // arrival: it stops the guest waiting at a locked gate AND stops staff
  // waiting around all day for an unknown arrival time. Worded from whoever
  // is actually sending it \u2014 Raman speaking for himself, or the owner
  // pointing the guest to Raman by name.
  const callAhead = senderRole === 'owner'
    ? `\u2705 Please call or WhatsApp ${MANAGER_NAME} about 1 hour before you reach Guruvayur \u2014 that way he's already waiting at the gate when you arrive, instead of either of you waiting on the other.`
    : `\u2705 Please call or WhatsApp me about 1 hour before you reach Guruvayur \u2014 that way I'm already waiting at the gate when you arrive, instead of either of us waiting on the other.`

  const lines = [
    `Namaskaram ${name}! \uD83D\uDE4F`,
    ``,
    intro,
    ``,
    `*BOOKING INFO*`,
    `\u2022 Max guest count: ${totalGuests} guest${totalGuests !== 1 ? 's' : ''}${breakdown} \u2014 count validated at check-in`,
    `\u2022 Bedrooms: ${VILLA_BEDROOMS} bedrooms [Standard Indian Queen size beds]`,
    `\u2022 Nights of stay: ${nights || '\u2014'}`,
    `\u2022 Check-in: ${ci || '\u2014'} \u2014 ${ciTime}`,
    `\u2022 Check-out: ${co || '\u2014'} \u2014 ${coTime}`,
    ``,
    `\u23F0 IMPORTANT: please keep a close watch on the check-in and check-out times above. Unless a different time has been agreed with us in advance, these timings are critical \u2014 the next guest's arrival and the villa's preparation are planned around them.`,
    ``,
    `*DRIVING DIRECTIONS*`,
    `\uD83D\uDCCD ${VILLA_MAPS_LINK}`,
    VILLA_ADDRESS,
    ``,
    `*STAFF ON SITE*`,
    `\uD83D\uDC64 ${MANAGER_NAME} \u2014 ${MANAGER_PHONE}`,
    ``,
    callAhead,
    ``,
    // When Biji himself sends this, the "reach out to our host" line would be
    // telling the guest to contact the person they're already messaging \u2014
    // only included in Raman's version, where it genuinely routes elsewhere.
    ...(senderRole === 'owner' ? [] : [
      `Note: any changes to your booking (dates, guest count, or requests) need to be approved directly by our host Biji \u2014 please reach out on WhatsApp at ${HOST_WA_NUMBER}.`,
      ``,
    ]),
    `Looking forward to hosting you! \uD83C\uDFE1`,
  ]

  return lines.join('\n')
}

/**
 * Builds a wa.me deep-link (pre-filled, not auto-sent) that opens the guest's
 * chat with the message ready to send. Returns null if no phone is on file.
 * @param {object} opts - forwarded to buildArrivalMessage, see there.
 */
export function buildArrivalWaLink(stay = {}, opts = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const raw = String(phone).replace(/\D/g, '')
  const num = raw.startsWith('91') ? raw : (raw.length === 10 ? `91${raw}` : raw)
  const msg = encodeURIComponent(buildArrivalMessage(stay, opts))
  return `https://wa.me/${num}?text=${msg}`
}
