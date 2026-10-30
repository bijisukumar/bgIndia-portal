// Single source of truth for how a booking's channel/source is displayed.
// Data-driven: an unknown source is Title-cased automatically, so a new channel partner
// (Booking.com, Expedia, Agoda, …) shows correctly with NO code change.
//
// What each platform IS (its name, the spellings it goes by in the data, its colours) is not written here: it is read from the
// partner files in /partners by src/utils/partners.js. This file only decides how a name is shown.
import { channelKey, channelsMatch, channelLabel, sourceStyle, isDirectSource, DIRECT_STYLE, AGENT_STYLE, PARTNERS } from './partners.js'

// ── Telling two spellings of one platform apart from two platforms ────────
// Stays store whatever the booking form sent ('Booking.com', 'booking_com',
// 'airbnb'…) and calendar feeds store what the owner typed, so names are compared
// by a normalised key rather than as written. Shared by the Worker (the hub
// calendar in src/server/icalHub.js) and the Channel calendar screen, so the two
// can never disagree about which platform a name means.
export { channelKey, channelsMatch, channelLabel, sourceStyle, DIRECT_STYLE, AGENT_STYLE, PARTNERS }

// Direct = green (owner's own booking); any channel partner = blue (OTA).
export function channelPillStyle(source) {
  return isDirectSource(source)
    ? { color: '#34A853', border: '1px solid rgba(52,168,83,0.35)', background: 'rgba(52,168,83,0.10)' }
    : { color: '#85B7EB', border: '1px solid rgba(133,183,235,0.35)', background: 'rgba(133,183,235,0.10)' }
}

// ── Group and colour on the Channel calendar ──────────────────────────────
// Every booking falls into one group: a CHANNEL PARTNER (a platform, each with its own
// colour), a DIRECT booking (website, WhatsApp, phone, referral, walk-in: one colour), an
// AGENT booking (a travel agent or sales partner), or OTHER. The colours are spread round
// the colour wheel so no two read alike, and kept clear of the amber the calendar uses for
// held nights; they are set in each partner's file. `text` is the colour of the words on a
// bar of that colour (the light colours need dark words). A platform nobody has described
// gets a stable colour from a separate palette (partners/index.js), so a calendar added by
// pasting a new link still looks the same every time. sourceStyle(source) gives
// { group, key, label, color, text } for a booking source.

// '#FF5A5F', 0.14 -> 'rgba(255,90,95,0.14)'
export function colorAlpha(hex, alpha) {
  const h = String(hex || '').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  if (isNaN(n)) return `rgba(148,163,184,${alpha})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

// The small tinted label ("Airbnb" in Airbnb's colour) used wherever a source is named.
export function sourcePill(source) {
  const s = sourceStyle(source)
  return { color: s.color, border: `1px solid ${colorAlpha(s.color, 0.5)}`, background: colorAlpha(s.color, 0.14) }
}
