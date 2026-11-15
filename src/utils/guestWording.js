// ============================================================
//  guestWording.js — small PURE helpers for the words a guest reads, shared by the browser (the WhatsApp messages in
//  guestMessages.js, the quote in villaPricing.js) and the Worker (the check-in email, utils/checkinEmail.js). They live here, with
//  no import of the browser config, because the Worker cannot load a module that reads it: guestMessages.js and villaPricing.js both
//  do, so each now imports (and re-exports) its helper from here instead of keeping a copy.
// ============================================================

// ~2 guests to a bedroom as a simple display estimate (not an occupancy rule).
export const GUESTS_PER_BEDROOM = 2

// The one rule for "how many bedrooms does this party take": about two guests to a room,
// rounded up, never more than the villa has; an unknown party size means the whole villa.
// Used by the enquiry quote (getBedroomEstimate), the host intro, the arrival message and the
// check-in email, so a family of 5 is told 3 bedrooms everywhere, not the villa's full 4.
export function bedroomsNeeded(villaBedrooms, billableGuests) {
  const max = Number(villaBedrooms) || 0
  if (!billableGuests || billableGuests <= 0) return max
  return Math.min(max || 1, Math.ceil(billableGuests / GUESTS_PER_BEDROOM))
}

// The word to greet a guest by. Enquiries are often typed in capitals ("VIGNESH M"), and a greeting in capitals
// shouts; and many names put initials first ("P. B Krishnan"), where the first WORD is no name at all
// ("Namaskaram P.!", 2026-10-24). So: the first word of two or more letters that is not a title (Mr, Dr, Shri...).
const GREETING_TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'shri', 'sri', 'smt', 'sreemati'])
export function greetingName(fullName) {
  const words = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'there'
  const letters = w => w.replace(/[^\p{L}]/gu, '')
  const pick = words.find(w => letters(w).length >= 2 && !GREETING_TITLES.has(letters(w).toLowerCase())) || words[0]
  const first = pick.replace(/[.,;:]+$/, '')
  if (!first) return 'there'
  const shouting = first === first.toUpperCase() && first !== first.toLowerCase()
  return shouting ? first.charAt(0) + first.slice(1).toLowerCase() : first
}

// A calendar date written out ('2026-11-26' -> 'Thursday, 26 November 2026'), read as the date it is and never through a time
// zone, so it cannot slip a day for a reader far from India. '' when it is not a date. No Intl: the browser, the Worker and a test
// all print the same thing.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS   = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function parts(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  if (!m) return null
  const y = +m[1], mo = +m[2], d = +m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, mo, d, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() }
}
export function longDate(ymd) {
  const p = parts(ymd)
  return p ? `${WEEKDAYS[p.dow]}, ${p.d} ${MONTHS[p.mo - 1]} ${p.y}` : ''
}
// '2026-11-26' -> '26 November'
export function shortDate(ymd) {
  const p = parts(ymd)
  return p ? `${p.d} ${MONTHS[p.mo - 1]}` : ''
}
