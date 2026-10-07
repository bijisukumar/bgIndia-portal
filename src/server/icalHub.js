// The "hub" calendar: one private iCal link per booking platform, made of every
// night that is taken ANYWHERE ELSE — direct bookings entered here, plus the
// blocks pulled from the other platforms' calendars.
//
// Server-side only (the Worker imports it). Kept free of any database or
// request code so it can be tested on its own.
//
// Three rules do all the work:
//  1. A platform's link never contains that platform's own bookings. It already
//     knows them, and handing them back would make them look like foreign
//     blocks: cancel one on the platform and our copy would keep the dates shut
//     there until somebody noticed.
//  2. Everything else is included, whatever its source. A booking entered by
//     hand with no calendar behind it (WhatsApp, phone, the website) is exactly
//     the kind a platform cannot learn about any other way.
//  3. A night kept back by an agreed late check-out or early check-in is sent to
//     every platform, even the guest's own: it is not a booking any platform has.

// ── channel names ─────────────────────────────────────────────────────────
// Stays store whatever the booking form sent ('Booking.com', 'booking_com',
// 'airbnb'…) and feeds store what the owner typed, so names are compared by a
// normalised key rather than as written (shared with the Channel calendar
// screen, which has to group the same way).
import { channelKey, channelsMatch } from '../utils/channel.js'
export { channelKey, channelsMatch }

const KNOWN_LABELS = {
  airbnb: 'Airbnb', bookingcom: 'Booking.com', expedia: 'Expedia', vrbo: 'VRBO',
  makemytrip: 'MakeMyTrip', agoda: 'Agoda', goibibo: 'Goibibo', cleartrip: 'Cleartrip',
}
// Sources that are the owner's own bookings rather than a platform.
const OWN_SOURCES = new Set(['', 'direct', 'website', 'guestform', 'manualtrigger', 'whatsapp', 'phone', 'agent', 'referral', 'walkin', 'other'])

// How a source reads in the calendar entry ("Unavailable (Booking.com)").
export function sourceLabel(name) {
  const k = channelKey(name)
  if (KNOWN_LABELS[k]) return KNOWN_LABELS[k]
  if (OWN_SOURCES.has(k)) return 'Direct'
  return String(name).trim().split(/[\s._-]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── dates ─────────────────────────────────────────────────────────────────
// All dates are plain 'YYYY-MM-DD' strings, the way the database holds them.
export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Today in India, where the villas are — the server clock is UTC and would
// still say "yesterday" for the first five and a half hours of an Indian day.
export function todayIst(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}

// ── what goes in the calendar ─────────────────────────────────────────────
// stays:  [{ id, source, start, end, stamp }]      real bookings
// blocks: [{ id, channel, start, end, stamp }]     dates pulled from other platforms' calendars
// holds:  [{ id, kind, start, end, stamp }]        nights kept back by an agreed late check-out
//                                                  / early check-in (src/utils/stayHolds.js)
// Returns the events for `targetChannel`'s link, oldest first.
export function buildHubEvents({ stays = [], blocks = [], holds = [], targetChannel, today, horizonDays = 800 }) {
  const latest = addDays(today, horizonDays)
  const taken = new Set()
  const events = []

  const add = ev => {
    // A stay with no nights, or backwards dates, has nothing to block.
    if (!ev.start || !ev.end || ev.end <= ev.start) return
    // Already over (a stay that leaves today blocks only nights that are gone),
    // or further out than any platform looks.
    if (ev.end <= today || ev.start > latest) return
    // The same nights from two places (a booking entered here AND its block in
    // the platform's own calendar) are one event, not two.
    const dedupe = `${ev.start}|${ev.end}`
    if (taken.has(dedupe)) return
    taken.add(dedupe)
    events.push(ev)
  }

  // Bookings first, so when both describe the same nights the booking is the
  // one that keeps its identity (it is the steadier of the two).
  for (const s of stays) {
    if (channelsMatch(s.source, targetChannel)) continue
    add({ key: `stay:${s.id}`, start: s.start, end: s.end, label: sourceLabel(s.source), stamp: s.stamp })
  }
  for (const b of blocks) {
    if (channelsMatch(b.channel, targetChannel)) continue
    add({ key: `block:${b.id}`, start: b.start, end: b.end, label: sourceLabel(b.channel), stamp: b.stamp })
  }
  // A held night goes to EVERY platform, the one the guest booked through
  // included. That platform knows the booking, but not that the villa is still
  // occupied on the last afternoon, so its calendar would offer the night to the
  // next family, who would then want to arrive at 4 PM. (Rule 1 above does not
  // apply: a hold is not a booking the platform has, so it cannot turn into a
  // phantom block; it lives only while the agreed time does.)
  for (const h of holds) {
    add({ key: `hold:${h.id}`, start: h.start, end: h.end, label: h.kind === 'early_checkin' ? 'Early check-in' : 'Late check-out', stamp: h.stamp })
  }

  return events.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.key.localeCompare(b.key))
}

// ── iCalendar (RFC 5545) ──────────────────────────────────────────────────
const enc = new TextEncoder()

function escapeText(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// Lines may be at most 75 octets; a longer one continues on the next line,
// which starts with a single space. Splits between characters, never inside one.
function foldLine(line) {
  if (enc.encode(line).length <= 75) return line
  const parts = []
  let cur = '', bytes = 0, room = 75
  for (const ch of line) {
    const w = enc.encode(ch).length
    if (bytes + w > room) { parts.push(cur); cur = ''; bytes = 0; room = 74 }
    cur += ch; bytes += w
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

const icsDay = d => d.replace(/-/g, '')

// '2026-10-07 05:16:57' (the database's UTC) or an ISO string -> '20261007T051657Z'
function icsStamp(value, fallback) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  if (m) return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}Z`
  return fallback.toISOString().replace(/[-:]|\.\d{3}/g, '')
}

// A stable, opaque id per event, so a platform can tell "the same booking,
// moved" from "a new one" — and so no internal stay id is shown to a third party.
async function eventUid(key) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`stayvibe-hub:${key}`))
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 32)}@stayvibe360.com`
}

// A calendar with no events at all is refused by some platforms when the link
// is first connected. When there is genuinely nothing to publish, one entry in
// the past stands in; no platform blocks a night for it.
const PLACEHOLDER = { key: 'placeholder', start: '2020-01-01', end: '2020-01-02', label: null, stamp: '2020-01-01 00:00:00' }

export async function renderHubIcs({ events, calendarName, now = new Date() }) {
  const list = events.length ? events : [PLACEHOLDER]
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StayVibe360//Calendar hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-PUBLISHED-TTL:PT15M',
  ]
  for (const ev of list) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${await eventUid(ev.key)}`,
      `DTSTAMP:${icsStamp(ev.stamp, now)}`,
      `DTSTART;VALUE=DATE:${icsDay(ev.start)}`,
      // For an all-day event DTEND is the day AFTER the last blocked night —
      // the check-out date, which is how stays are already stored.
      `DTEND;VALUE=DATE:${icsDay(ev.end)}`,
      `SUMMARY:${escapeText(ev.label ? `Unavailable (${ev.label})` : 'StayVibe360 calendar (no upcoming bookings)')}`,
      'TRANSP:OPAQUE',
      'STATUS:CONFIRMED',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
