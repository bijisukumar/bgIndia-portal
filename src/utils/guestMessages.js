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
import { parseLocalDate, formatTime12h } from './dates'

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
  const cfg = CONFIG.guestMessages?.hostIntro
  if (!cfg?.template) return null   // see buildCheckinLinkMessage — same runtime-config fragility
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

  // An approved early-checkin/late-checkout time overrides the house
  // default — this is exactly what Complete Booking already shows Raman,
  // so the guest's own intro message shouldn't quote a stale 4pm/11am when
  // an 11am arrival (say) was already agreed and captured.
  return renderTemplate(cfg.template, {
    firstName: ((stay.guest_name || '').trim().split(/\s+/)[0]) || 'there',
    checkinDateShort: fmtShort(ci),
    checkinDateFull:  fmtFull(ci),
    checkoutDateFull: fmtFull(co),
    guestCount,
    nights: nights || '—',
    checkinTime:  stay.early_checkin_time ? formatTime12h(stay.early_checkin_time) : villa.checkinTime,
    checkoutTime: stay.late_checkout_time ? formatTime12h(stay.late_checkout_time) : villa.checkoutTime,
    checkinPrompt,
  })
}

export function buildHostIntroWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const msg = buildHostIntroMessage(stay)
  if (!msg) return null
  return waLink(phone, msg)
}

// Standalone check-in-link nudge — just the reminder + link, for a guest
// who's already had the full welcome and only needs a follow-up. Text is
// host-configurable (CONFIG.guestMessages.checkinLinkOnly), same as every
// other template here — see hosts/dwarka/config.js for why it isn't shared
// across hosts. Returns null (no button to show) when there's nothing to
// send: no channel link configured, or the guest already registered.
export function buildCheckinLinkMessage(stay = {}) {
  const url = checkinUrlFor(stay)
  if (!url || stay.checkin_form_submitted) return null
  // CONFIG is fetched at runtime (see src/config.js) from a D1-backed copy
  // that isn't guaranteed to be in sync with a just-edited hosts/<id>/
  // config.js — a missing key here must never throw, since this runs
  // unconditionally on every Complete Booking render with no error boundary
  // above it; an uncaught error here blanks the entire page, not just this
  // button. Missing config silently means "don't show the button" instead.
  const tpl = CONFIG.guestMessages?.checkinLinkOnly?.template
  if (!tpl) return null
  return renderTemplate(tpl, { checkinUrl: url })
}

export function buildCheckinLinkWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const msg = buildCheckinLinkMessage(stay)
  if (!msg) return null
  return waLink(phone, msg)
}

export function buildComfortCheckMessage(stay = {}) {
  const tpl = CONFIG.guestMessages?.comfortCheck?.template
  if (!tpl) return null   // see buildCheckinLinkMessage — same runtime-config fragility
  return renderTemplate(tpl, {
    guestName: (stay.guest_name || '').trim() || 'there',
    villaName: villa.full,
    managerName: villa.managerName,
    managerPhone: villa.managerPhone,
  })
}

export function buildComfortCheckWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const msg = buildComfortCheckMessage(stay)
  if (!msg) return null
  return waLink(phone, msg)
}

export function buildFarewellMessage(stay = {}) {
  const tpl = CONFIG.guestMessages?.farewell?.template
  if (!tpl) return null   // see buildCheckinLinkMessage — same runtime-config fragility
  return renderTemplate(tpl, {
    guestName: (stay.guest_name || '').trim() || 'there',
    villaName: villa.full,
    managerName: villa.managerName,
    managerPhone: villa.managerPhone,
  })
}

export function buildFarewellWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const msg = buildFarewellMessage(stay)
  if (!msg) return null
  return waLink(phone, msg)
}

// ── REVIEW REQUEST ────────────────────────────────────────────────────────
// Deliberately available the moment a guest checks out, not the next day.
// A guest writes their best review from the car; by tomorrow the stay has
// blurred into the drive home. Both the owner and the staff member who did
// the check-out can send it.
//
// The platform follows the booking channel — asking an Airbnb guest for a
// Google review sends them somewhere they have no booking.
export function buildReviewRequestMessage(stay = {}) {
  const cfg = CONFIG.guestMessages?.reviewRequest
  if (!cfg?.template) return null   // same runtime-config fragility as the rest

  const src = String(stay.source || '').toLowerCase()
  const platforms = cfg.platforms || {}
  const links     = cfg.links || {}
  const reviewPlatform = platforms[src] || platforms.default || 'Google'
  const rawLink        = links[src] || links.default || ''

  return renderTemplate(cfg.template, {
    firstName: ((stay.guest_name || '').trim().split(/\s+/)[0]) || 'there',
    // The villa's guest-facing name, not CONFIG.brandName — that is the
    // internal portal brand ("Guruvayur Estates") which no guest recognises.
    villaName: villa.arrivalFullName || villa.full || villa.name || CONFIG.brandName || '',
    reviewPlatform,
    // Blank when unset so the message never ends on a dangling label.
    reviewLink: rawLink ? `${rawLink}\n\n` : '',
  })
}

export function buildReviewRequestWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const msg = buildReviewRequestMessage(stay)
  if (!msg) return null
  return waLink(phone, msg)
}
