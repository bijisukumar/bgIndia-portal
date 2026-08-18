// ============================================================
// guestMessages.js — owner-sent WhatsApp messages built from the
// per-host CONFIG.guestMessages templates:
//   • hostIntro    — personal welcome, any time before check-in
//   • comfortCheck — "hope you settled in", during the stay
//
// The checkout-day email is deliberately NOT here — see
// functions/api/[[route]].js (sendCheckoutEmailNow / the 6am
// autosend), which reads CONFIG.guestMessages.checkoutDay
// server-side because that send has no browser to build it in.
// ============================================================

import { CONFIG } from '../config'
import { parseLocalDate } from './dates'

const villa = CONFIG.villas[0]

function renderTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, key) => (vars[key] != null ? vars[key] : m))
}

// Only assume India's country code for a bare 10-digit number with no '+'
// in the original string. Blindly prepending '91' corrupts a real
// international number (a US +1 214… becoming 91 1 214…) — a bug this
// codebase has now hit more than once, so every wa.me link goes through here.
//
// Trunk prefixes are stripped FIRST, because they inflate the digit count
// and make a domestic number look international. "08197785354" is a normal
// Indian mobile with the domestic trunk 0 in front: 11 digits, no '+', so
// the length test alone called it international and produced a dead
// wa.me/08197785354. Guests type that 0 constantly.
export function waNumber(phone) {
  const phoneStr = String(phone || '')
  let digits = phoneStr.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('00')) {
    // '00' is the international access code — what follows already carries
    // its own country code, so never prepend one.
    digits = digits.slice(2)
    return digits || null
  }
  // A single leading 0 before a 10-digit number is the domestic trunk
  // prefix, not part of the number.
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)

  const looksInternational = phoneStr.includes('+') || digits.length > 10
  return looksInternational ? digits : `91${digits}`
}

function waLink(phone, text) {
  const num = waNumber(phone)
  if (!num) return null
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}

// stays.source → the guest's own check-in link. Falls back to the default
// token for channels with no link of their own (website, whatsapp, agoda…).
function checkinUrlFor(stay) {
  const base = CONFIG.checkinBaseUrl
  if (!base) return ''
  const src = String(stay.source || '').trim().toLowerCase()
  const token = (CONFIG.checkinLinkTokens || {})[src] || CONFIG.checkinLinkDefaultToken
  return token ? `${base}/checkin/${token}` : ''
}

export function buildHostIntroMessage(stay = {}) {
  const cfg = CONFIG.guestMessages.hostIntro
  const ci = parseLocalDate(stay.checkin_date)
  const co = parseLocalDate(stay.checkout_date)
  const fmtFull  = d => (d ? d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—')
  const fmtShort = d => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : '—')

  const adults   = parseInt(stay.adults, 10)   || 0
  const children = parseInt(stay.children, 10) || 0
  const total    = adults + children
  let guestCount = '—'
  if (total > 0) {
    const breakdown = children > 0
      ? ` (${adults} adult${adults !== 1 ? 's' : ''} + ${children} child${children !== 1 ? 'ren' : ''})`
      : ''
    guestCount = `${total} total${breakdown}`
  }

  let nights = parseInt(stay.nights, 10) || 0
  if (!nights && ci && co) nights = Math.max(1, Math.round((co - ci) / 86400000))

  // Never ask a guest who has already registered. Also omitted entirely if
  // this host has no check-in link configured, so the message can't ship a
  // dangling "please complete it here:" with nothing after it.
  const url = checkinUrlFor(stay)
  const checkinPrompt = (stay.checkin_form_submitted || !url)
    ? ''
    : renderTemplate(cfg.checkinPrompt, { checkinUrl: url })

  return renderTemplate(cfg.template, {
    firstName: ((stay.guest_name || '').trim().split(/\s+/)[0]) || 'there',
    checkinDateShort: fmtShort(ci),
    checkinDateFull:  fmtFull(ci),
    checkoutDateFull: fmtFull(co),
    guestCount,
    nights: nights || '—',
    checkinTime:  villa.checkinTime,
    checkoutTime: villa.checkoutTime,
    checkinPrompt,
  })
}

export function buildHostIntroWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  return waLink(phone, buildHostIntroMessage(stay))
}

export function buildComfortCheckMessage(stay = {}) {
  return renderTemplate(CONFIG.guestMessages.comfortCheck.template, {
    guestName: (stay.guest_name || '').trim() || 'there',
    villaName: villa.full,
    managerName: villa.managerName,
    managerPhone: villa.managerPhone,
  })
}

export function buildComfortCheckWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  return waLink(phone, buildComfortCheckMessage(stay))
}

export function buildFarewellMessage(stay = {}) {
  return renderTemplate(CONFIG.guestMessages.farewell.template, {
    guestName: (stay.guest_name || '').trim() || 'there',
    villaName: villa.full,
    managerName: villa.managerName,
    managerPhone: villa.managerPhone,
  })
}

export function buildFarewellWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  return waLink(phone, buildFarewellMessage(stay))
}
