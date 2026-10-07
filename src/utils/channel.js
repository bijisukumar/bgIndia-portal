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

// ── Group and colour on the Channel calendar ──────────────────────────────
// Every booking falls into one group: a CHANNEL PARTNER (a platform such as Airbnb,
// each with its own colour), a DIRECT booking (website, WhatsApp, phone, referral,
// walk-in: one colour), an AGENT booking (a travel agent or sales partner), or OTHER.
// The colours are spread round the colour wheel so no two read alike, and kept clear
// of the amber the calendar uses for held nights. `text` is the colour of the words on
// a bar of that colour (the light colours need dark words). A platform the app does not
// know gets a stable colour from a separate palette, so a calendar added by pasting a
// new link still looks the same every time.
export const PARTNERS = [        // always listed, in this order
  { key: 'airbnb',     label: 'Airbnb',      color: '#FF5A5F', text: '#FFFFFF' },
  { key: 'bookingcom', label: 'Booking.com', color: '#2563EB', text: '#FFFFFF' },
  { key: 'vrbo',       label: 'VRBO',        color: '#38BDF8', text: '#0B1220' },
  { key: 'agoda',      label: 'Agoda',       color: '#8B5CF6', text: '#FFFFFF' },
  { key: 'expedia',    label: 'Expedia',     color: '#FACC15', text: '#0B1220' },
  { key: 'makemytrip', label: 'MakeMyTrip',  color: '#EA580C', text: '#FFFFFF' },
  { key: 'goibibo',    label: 'Goibibo',     color: '#EC4899', text: '#FFFFFF' },
]
const MORE_PARTNERS = [          // known, listed only when the villa uses them
  { key: 'cleartrip', label: 'Cleartrip', color: '#84CC16', text: '#0B1220' },
]
export const DIRECT_STYLE = { group: 'direct', key: 'direct', label: 'Direct', color: '#34A853', text: '#FFFFFF' }
export const AGENT_STYLE  = { group: 'agent',  key: 'agent',  label: 'Agent',  color: '#D946EF', text: '#FFFFFF' }
const OTHER_STYLE = { group: 'other', key: 'other', label: 'Other', color: '#94A3B8', text: '#0B1220' }
const FALLBACK_COLORS = ['#14B8A6', '#A8805A', '#9CA3AF', '#6366F1']

// Bookings the villa takes itself, whichever door they came through.
const OWN_KEYS = new Set(['', 'direct', 'website', 'guestform', 'manualtrigger', 'whatsapp', 'phone', 'referral', 'walkin'])
const AGENT_KEY = /^(agent|agents|agency|travelagent|travelagents|travelagency|salesagent|salespartner|tourop)/

// { group: 'channel' | 'direct' | 'agent' | 'other', key, label, color, text } for a
// booking source ('airbnb', 'booking_com', 'Website', 'agent', ...). All the direct
// doors share one key, so they add up as one in a tally.
export function sourceStyle(source) {
  const k = channelKey(source)
  if (OWN_KEYS.has(k)) return DIRECT_STYLE
  if (AGENT_KEY.test(k)) return AGENT_STYLE
  if (k === 'other') return OTHER_STYLE
  const p = PARTNERS.concat(MORE_PARTNERS).find(x => channelsMatch(k, x.key))
  if (p) return { group: 'channel', key: p.key, label: p.label, color: p.color, text: p.text }
  let hash = 0
  for (const ch of k) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return { group: 'channel', key: k, label: channelLabel(source), color: FALLBACK_COLORS[hash % FALLBACK_COLORS.length], text: '#FFFFFF' }
}

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
