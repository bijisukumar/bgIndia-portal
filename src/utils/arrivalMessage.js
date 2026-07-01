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
  const name = (stay.guest_name || '').trim().split(' ')[0] || 'there'
  const ci = fmtLong(stay.checkin_date)
  const co = fmtLong(stay.checkout_date)
  const adults   = parseInt(stay.adults, 10)   || 1
  const children = parseInt(stay.children, 10) || 0

  const extended = []
  if (stay.request_early_checkin) extended.push('Early check-in requested ⏰')
  if (stay.request_late_checkout) extended.push('Late check-out requested 🌙')

  const lines = [
    `Namaskaram ${name}! 🙏`,
    ``,
    `This is Raman, your host coordinator at ${VILLA_FULL_NAME}. Happy to confirm — your booking is all set! ✅`,
    ``,
    `📅 Check-in: ${ci || '—'}`,
    `📅 Check-out: ${co || '—'}`,
    `👥 Max Guests: ${adults} adult${adults !== 1 ? 's' : ''}${children > 0 ? ` + ${children} child${children !== 1 ? 'ren' : ''}` : ''}`,
  ]

  if (extended.length) lines.push(`⏳ ${extended.join(' · ')}`)

  lines.push(
    ``,
    `📍 Location: ${VILLA_MAPS_LINK}`,
    VILLA_ADDRESS,
    ``,
    `A couple of things so I'm ready and waiting for you at the gate:`,
    `1️⃣ Please message me on this number about 1 hour before you reach Guruvayur.`,
    `2️⃣ I'll be at the villa to welcome you and help with check-in — same at check-out, just give me a heads-up on your departure time.`,
    ``,
    `Note: any changes to your booking (dates, guest count, or requests) need to be approved directly by our host Biji — please reach out on WhatsApp at ${HOST_WA_NUMBER}.`,
    ``,
    `Looking forward to hosting you! 🏡`,
  )

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
