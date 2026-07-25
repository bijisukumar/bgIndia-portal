// ============================================================
// guestMessages.js — "Comfort check" WhatsApp message for guests
// who have already checked in. Sent by the owner, any time during
// the stay. The checkout-day email is separate — see
// functions/api/[[route]].js (sendCheckoutEmailNow / autosend),
// which reads the same CONFIG.guestMessages.checkoutDay template
// server-side since that send has no browser to build it in.
// ============================================================

import { CONFIG } from '../config'

const villa = CONFIG.villas[0]

function renderTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, key) => (vars[key] != null ? vars[key] : m))
}

export function buildComfortCheckMessage(stay = {}) {
  const vars = {
    guestName: (stay.guest_name || '').trim() || 'there',
    villaName: villa.full,
    managerName: villa.managerName,
    managerPhone: villa.managerPhone,
  }
  return renderTemplate(CONFIG.guestMessages.comfortCheck.template, vars)
}

export function buildComfortCheckWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const raw = String(phone).replace(/\D/g, '')
  const num = raw.startsWith('91') ? raw : (raw.length === 10 ? `91${raw}` : raw)
  const msg = encodeURIComponent(buildComfortCheckMessage(stay))
  return `https://wa.me/${num}?text=${msg}`
}
