// Single source of truth for how a booking's channel/source is displayed.
// Data-driven: an unknown source is Title-cased automatically, so a new channel
// partner (Booking.com, Expedia, Agoda, …) shows correctly with NO code change.

const KNOWN = {
  direct:       'Direct',
  airbnb:       'Airbnb',
  'booking.com':'Booking.com', bookingcom: 'Booking.com', booking: 'Booking.com', booking_com: 'Booking.com',
  expedia:      'Expedia',
  vrbo:         'VRBO',
  makemytrip:   'MakeMyTrip', mmt: 'MakeMyTrip',
  agoda:        'Agoda',
  goibibo:      'Goibibo',
  cleartrip:    'Cleartrip',
}

export function channelLabel(source) {
  const s = (source || '').trim().toLowerCase()
  if (!s) return 'Direct'
  if (KNOWN[s]) return KNOWN[s]
  // Fallback: Title-case the raw value so brand-new channels just work.
  return s.split(/[\s._-]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Direct = green (owner's own booking); any channel partner = blue (OTA).
export function channelPillStyle(source) {
  const s = (source || '').trim().toLowerCase()
  const isDirect = !s || s === 'direct'
  return isDirect
    ? { color: '#34A853', border: '1px solid rgba(52,168,83,0.35)', background: 'rgba(52,168,83,0.10)' }
    : { color: '#85B7EB', border: '1px solid rgba(133,183,235,0.35)', background: 'rgba(133,183,235,0.10)' }
}

// ── Telling two spellings of one platform apart from two platforms ────────
// Stays store whatever the booking form sent ('Booking.com', 'booking_com',
// 'airbnb'…) and calendar feeds store what the owner typed, so names are compared
// by a normalised key rather than as written. Shared by the Worker (the hub
// calendar in src/server/icalHub.js) and the Channel calendar screen, so the two
// can never disagree about which platform a name means.
const ALIASES = { booking: 'bookingcom', mmt: 'makemytrip' }

export function channelKey(name) {
  const k = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return ALIASES[k] || k
}

// The same platform under two spellings ('agoda' / 'agodahomes'). A short key
// that is the start of a longer one counts, but only from 4 letters up, so two
// unrelated short names can never collide.
export function channelsMatch(a, b) {
  const x = channelKey(a), y = channelKey(b)
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length >= 4 && long.startsWith(short)
}
