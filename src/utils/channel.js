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
