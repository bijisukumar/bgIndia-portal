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
import { guestFacingTimes } from './stayTimes'
import { dayMonth } from './stayHolds'
import { bedroomsNeeded } from './villaPricing'

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

// The base every link the owner copies to hand a guest is built on — check-in,
// agent quote, flexibility. It is the tenant's canonical public domain (the one
// the WhatsApp check-in links above already use), not whatever address the
// owner's screen happens to be open on: several owner screens are also routed
// in the manage console, which serves none of the guest pages, and an older
// address would take every link already sent down with it. Falls back to the
// current origin for a host that has not set one.
export function guestBaseUrl() {
  return (CONFIG.checkinBaseUrl || window.location.origin).replace(/\/+$/, '')
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

// Spliced into {checkinPrompt} when the guest has ALREADY done the online check-in form: a thank
// you in place of the ask. A host can word it itself with CONFIG.guestMessages.hostIntro
// .checkinThanks. Blank lines either side keep the paragraph spacing, as the ask's do. No emoji:
// it goes out through wa.me, where they arrive as "�" on WhatsApp for Windows.
const DEFAULT_CHECKIN_THANKS =
  '\n*Pre-Arrival Registration*\nThank you for completing your online check-in registration — it helps us ensure a smooth, hassle-free arrival.\n'

export function buildHostIntroMessage(stay = {}) {
  const cfg = CONFIG.guestMessages?.hostIntro
  if (!cfg?.template) return null   // see buildCheckinLinkMessage — same runtime-config fragility
  // Same reasoning as the check-in link: this message says "ahead of your
  // stay", so it makes no sense once the guest has arrived or left.
  if (ARRIVED_OR_DONE.has(String(stay.status || '').trim().toLowerCase())) return null
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

  // Which of the villa's bedrooms this party actually needs, not how many
  // the villa has — two guests to a room, rounded up, capped at what's
  // actually there. 3 guests -> 2 rooms, 5 or 6 -> 3, anything past what
  // fills every room just shows the villa's full count. Unknown guest count
  // (total 0) shows the villa's full count too, same as "how big is this
  // place" rather than a wrong small number.
  const totalBedrooms = villa.bedrooms || 0
  const roomsForParty = bedroomsNeeded(totalBedrooms, total)   // the shared rule, src/utils/villaPricing.js
  const bedroomLine = totalBedrooms
    ? (cfg.bedType ? `${roomsForParty} [${cfg.bedType}]` : `${roomsForParty}`)
    : '—'

  // A guest who has already done the online check-in form is THANKED for it, never asked again
  // (stay.checkin_form_submitted: getUpcomingStays must return it; it once did not, so every guest
  // looked unregistered and was asked to register a second time). One who has not is asked, with
  // the link; if this host has no check-in link configured the ask is left out entirely, so the
  // message can't ship a dangling "please complete it here:" with nothing after it.
  const url = checkinUrlFor(stay)
  let checkinPrompt = ''
  if (stay.checkin_form_submitted) checkinPrompt = cfg.checkinThanks != null ? cfg.checkinThanks : DEFAULT_CHECKIN_THANKS
  else if (url) checkinPrompt = renderTemplate(cfg.checkinPrompt, { checkinUrl: url })

  // An approved early-checkin/late-checkout time overrides the house
  // default — this is exactly what Complete Booking already shows Raman,
  // so the guest's own intro message shouldn't quote a stale 4pm/11am when
  // an 11am arrival (say) was already agreed and captured. The guest's own
  // expected arrival / departure from the check-in form is added beside it, but
  // only when it fits what the villa gives (see guestFacingTimes): a time the
  // owner has not agreed to is never quoted back as if it had been. It goes into
  // the existing {checkinTime} / {checkoutTime} slots, so no template (and no
  // re-seeded config) is needed.
  const gt = guestFacingTimes(stay, { checkin: villa.checkinTime, checkout: villa.checkoutTime })
  return renderTemplate(cfg.template, {
    firstName: ((stay.guest_name || '').trim().split(/\s+/)[0]) || 'there',
    checkinDateShort: fmtShort(ci),
    checkinDateFull:  fmtFull(ci),
    checkoutDateFull: fmtFull(co),
    guestCount,
    bedroomLine,
    nights: nights || '—',
    checkinTime:  gt.arrivalNote   ? `${gt.inTime} (${gt.arrivalNote})`    : gt.inTime,
    checkoutTime: gt.departureNote ? `${gt.outTime} (${gt.departureNote})` : gt.outTime,
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
// Stages at which a check-in link is pointless: the guest is already in the
// villa, has left, or the booking is dead. Sending one then is confusing at
// best — this was showing on Complete Booking for a guest who had checked out
// the day before.
const ARRIVED_OR_DONE = new Set([
  'checked_in', 'ready_for_checkout', 'checked_out', 'closed',
  'cancelled', 'void', 'no_show',
])

export function buildCheckinLinkMessage(stay = {}) {
  const url = checkinUrlFor(stay)
  if (!url || stay.checkin_form_submitted) return null
  if (ARRIVED_OR_DONE.has(String(stay.status || '').trim().toLowerCase())) return null
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
  // hasOwnProperty, not ||: a channel deliberately set to blank must mean
  // "no link for this platform", not "fall through to the default". Otherwise
  // a Booking.com guest is told to review on Booking.com and handed a Google
  // link.
  const entry = Object.prototype.hasOwnProperty.call(links, src) ? links[src] : links.default
  const linkUrl   = typeof entry === 'string' ? entry : (entry?.url || '')
  const linkLabel = typeof entry === 'string' ? '' : (entry?.label || '')

  return renderTemplate(cfg.template, {
    firstName: ((stay.guest_name || '').trim().split(/\s+/)[0]) || 'there',
    // The villa's guest-facing name, not CONFIG.brandName — that is the
    // internal portal brand ("Guruvayur Estates") which no guest recognises.
    villaName: villa.arrivalFullName || villa.full || villa.name || CONFIG.brandName || '',
    reviewPlatform,
    // Blank when unset so the message never ends on a dangling label.
    // Label then URL on its own line, so WhatsApp makes the URL tappable.
    // Blank when the platform has no usable link, leaving no dangling text.
    reviewLink: linkUrl ? `${linkLabel ? linkLabel + '\n' : ''}${linkUrl}\n\n` : '',
  })
}

export function buildReviewRequestWaLink(stay = {}) {
  const phone = stay.guest_phone || stay.phone
  if (!phone) return null
  const msg = buildReviewRequestMessage(stay)
  if (!msg) return null
  return waLink(phone, msg)
}

// ── "THOSE DATES ARE NOT AVAILABLE" REPLY ─────────────────────────────────
// Offered on the New enquiry screen when the dates asked for are taken: an
// apology, the dates asked for, and windows of the same length just before and
// after that ARE open (worked out by the Worker's checkAvailability, with the
// same taken-nights rules as the calendar: bookings, nights held by an agreed
// late check-out / early check-in, dates closed on a platform's calendar).
// It never says who holds the dates.
//
// Wording: the built-in text below; a host can replace it with
// CONFIG.guestMessages.noAvailability.template, which may use {firstName}
// {villaName} {requestedDates} {nights} {options} {ownerName} {phoneLine}.
// Plain text on purpose: this travels through wa.me, where astral-plane emoji
// arrive as "�" on WhatsApp Desktop for Windows.
const DEFAULT_NO_AVAILABILITY = [
  'Namaskaram {firstName},',
  '',
  'Thank you for your enquiry for {villaName}.',
  '',
  'I am sorry, the villa is not available for the dates you asked about:',
  '{requestedDates}',
  '',
  '{options}',
  '',
  'Thank you for your understanding.',
  '',
  'സസ്നേഹം (Sasneham)',
  '{ownerName}',
  '{villaName}',
  '{phoneLine}',
].join('\n')

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBR   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 'YYYY-MM-DD' -> { y, m, d, dow } read as a calendar date, never through the
// viewer's time zone (so a date cannot slip a day for someone far from India).
function calendarDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!m) return null
  const y = +m[1], mo = +m[2], d = +m[3]
  return { y, m: mo, d, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() }
}
// Two plain functions rather than one with a flag: the production minifier has
// been seen dropping a helper's second argument (see src/utils/stayHolds.js).
function dayLabel(iso) {
  const c = calendarDate(iso)
  return c ? WEEKDAY_ABBR[c.dow] + ' ' + c.d + ' ' + MONTH_ABBR[c.m - 1] : String(iso || '')
}
function dayLabelYear(iso) {
  const c = calendarDate(iso)
  return c ? dayLabel(iso) + ' ' + c.y : String(iso || '')
}
function windowLine(w, year) {
  const crossesYear = String(w.checkIn).slice(0, 4) !== year || String(w.checkOut).slice(0, 4) !== year
  return crossesYear
    ? '* ' + dayLabelYear(w.checkIn) + ' to ' + dayLabelYear(w.checkOut)
    : '* ' + dayLabel(w.checkIn) + ' to ' + dayLabel(w.checkOut)
}

// Enquiries are often typed in capitals ("VIGNESH M"), and a greeting in capitals shouts.
export function greetingName(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0] || ''
  if (!first) return 'there'
  const shouting = first === first.toUpperCase() && first !== first.toLowerCase()
  return shouting ? first.charAt(0) + first.slice(1).toLowerCase() : first
}

// { guestName, checkIn, checkOut ('YYYY-MM-DD'), alternatives } -> the message
// text, or null when the dates are not usable. `alternatives` is what
// checkAvailability returned: { nights, before: [{checkIn, checkOut}], after: [...] }.
export function buildNoAvailabilityMessage({ guestName, checkIn, checkOut, alternatives } = {}) {
  const ci = calendarDate(checkIn)
  const co = calendarDate(checkOut)
  if (!ci || !co) return null
  const nights = Math.round((Date.UTC(co.y, co.m - 1, co.d) - Date.UTC(ci.y, ci.m - 1, ci.d)) / 86400000)
  if (!(nights >= 1)) return null
  const nightsWord = nights === 1 ? '1 night' : nights + ' nights'

  const before = (alternatives && alternatives.before) || []
  const after  = (alternatives && alternatives.after)  || []
  const year   = String(checkIn).slice(0, 4)

  let options
  if (before.length || after.length) {
    const lines = ['These dates are open for the same ' + nightsWord + ':']
    if (before.length) lines.push('', 'Earlier:', ...before.map(w => windowLine(w, year)))
    if (after.length)  lines.push('', 'Later:',   ...after.map(w => windowLine(w, year)))
    lines.push('', 'If one of these works for you, please let me know and I can block the dates for you. ' +
      'If your plans are flexible, tell me your preferred dates or number of nights and I will check for you.')
    options = lines.join('\n')
  } else {
    options = 'I do not have ' + nightsWord + ' open close to those dates just now. ' +
      'If your dates are flexible, please tell me and I will let you know as soon as something opens up.'
  }

  const template = CONFIG.guestMessages?.noAvailability?.template || DEFAULT_NO_AVAILABILITY
  const text = renderTemplate(template, {
    firstName: greetingName(guestName),
    villaName: villa.arrivalFullName || villa.full || villa.name || CONFIG.brandName || '',
    requestedDates: dayLabelYear(checkIn) + ' to ' + dayLabelYear(checkOut) + ' (' + nightsWord + ')',
    nights: String(nights),
    options,
    ownerName: CONFIG.ownerName || '',
    phoneLine: CONFIG.checkinAddress?.phone || '',
  })
  // Lines left empty by an unset name or phone must not leave a gap.
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function buildNoAvailabilityWaLink({ phone, ...rest } = {}) {
  if (!phone) return null
  const msg = buildNoAvailabilityMessage(rest)
  if (!msg) return null
  return waLink(phone, msg)
}

// The one line the enquiry's activity log keeps when that reply is sent: what was
// not available and what was offered, not the whole message.
//   "Replied on WhatsApp: dates not available (21 Oct–23 Oct). Offered: 16 Oct–18 Oct, 23 Oct–25 Oct."
export function noAvailabilityLogNote({ checkIn, checkOut, alternatives } = {}) {
  const span = w => dayMonth(w.checkIn) + '–' + dayMonth(w.checkOut)
  const offered = [...((alternatives && alternatives.before) || []), ...((alternatives && alternatives.after) || [])]
  return 'Replied on WhatsApp: dates not available (' + dayMonth(checkIn) + '–' + dayMonth(checkOut) + '). ' +
    (offered.length ? 'Offered: ' + offered.map(span).join(', ') + '.' : 'No open dates offered.')
}
