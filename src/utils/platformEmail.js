// ============================================================
//  BOOKING PLATFORM EMAILS: WHAT A "NEW BOOKING" / "CANCELLED" EMAIL SAYS (src/utils/platformEmail.js)
//
//  What it is: the reading of a booking platform's emails, for a platform whose bookings reach StayVibe as emails (its partner file in /partners has an
//  `email` block). Pure functions (no clock, no network, no database, no CONFIG), so the Worker bundles it and the tests can check every rupee and date.
//  It knows NO platform: who sends the emails, how to tell a confirmation from a cancellation and the words that come in front of each value are all
//  data in the partner file (partners/agoda.js `email`). A platform's emails changing, or a second platform arriving, is a change there, not here.
//
//    senderMatches(from, list)               is this email from one of the platform's senders?
//    emailKind(subject, kinds)               'confirmed' | 'cancelled' | 'modified' | 'other', from the subject
//    htmlToLines(html), bodyLines(email)     the email as trimmed, non-empty lines (a table cell becomes a line)
//    dateInWords(text)                       "5 Dec 2026" / "Dec 5, 2026" / "2026-12-05" / "05/12/2026" -> 'YYYY-MM-DD' or ''
//    datesInSubject(subject)                 "5 - 6 Dec 2026", "30 Nov - 2 Dec 2026", "31 Dec 2026 - 2 Jan 2027" -> { checkIn, checkOut } or null
//    parseBookingEmail(email, spec)          the booking in the email: id, dates, price, guests, name, country (or what is missing)
//    senderAuthFailed(authResults)           true when the mail system's own check says the sender was forged
//
//  WHAT CHANGED (newest first)
//    2026-11-27  New (Biji: "go, build the Agoda email capture"). Written against the real confirmation email's wording and tested on its three
//                possible text layouts, because what a mail reader hands over for an HTML email (a label then its value, or a row of labels
//                then a row of values) was not known in advance.
//  Related: partners/agoda.js (the `email` block), functions/api/[[route]].js (ingestPlatformEmail), apps-script/poll-reservations (pollPlatformEmails).
// ============================================================

// ── SMALL HELPERS ─────────────────────────────────────────────────────────
// A label or a line compared loosely: lower case, one space between words, no colon at the end, one kind of apostrophe and one kind of dash
// (an HTML email writes "guest’s" and "check‑in" with the curly and the non-breaking forms).
const norm = s => String(s == null ? '' : s).toLowerCase()
  .replace(/[’‘`´]/g, "'").replace(/[‐‑‒–—−]/g, '-')
  .replace(/[ \s]+/g, ' ').replace(/[:：]\s*$/, '').trim()
const pad2 = n => String(n).padStart(2, '0')
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const monthOf = word => MONTHS[String(word || '').toLowerCase().slice(0, 3)] || 0
const validYmd = (y, m, d) => {
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}
const ymd = (y, m, d) => (validYmd(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : '')
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)

// ── WHO SENT IT, AND WHAT IT IS ───────────────────────────────────────────
// from = the email's From header ("Name <address>" or just an address); list = the platform's senders: a full address matches exactly, a bare
// domain matches any address at it (or at a sub-domain of it).
export function senderMatches(from, list) {
  const m = /<([^>]+)>/.exec(String(from || ''))
  const addr = String(m ? m[1] : from || '').trim().toLowerCase()
  if (!addr) return false
  return (Array.isArray(list) ? list : []).some(entry => {
    const e = String(entry || '').trim().toLowerCase()
    if (!e) return false
    return e.includes('@') ? addr === e : (addr.endsWith('@' + e) || addr.endsWith('.' + e))
  })
}

// What an email is about, from its subject. kinds = { cancelled: ['cancel'], modified: [...], confirmed: [...] } (lower-case fragments); the FIRST kind listed
// that has a fragment in the subject wins, so the platform's file decides which is checked first. 'other' when none does.
export function emailKind(subject, kinds) {
  const s = norm(subject)
  for (const [kind, fragments] of Object.entries(kinds || {})) {
    if ((Array.isArray(fragments) ? fragments : []).some(f => f && s.includes(String(f).toLowerCase()))) return kind
  }
  return 'other'
}

// ── THE EMAIL AS LINES ────────────────────────────────────────────────────
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', hellip: '…' }
// An HTML email as text lines: the end of a cell, a row, a paragraph or a line break starts a new line, every other tag goes, entities are read.
// This is why a table of "label | label | label" over "value | value | value" comes out as labels first, then values, one per line.
export function htmlToLines(html) {
  let t = String(html || '')
  t = t.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
  t = t.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(td|th|tr|p|div|li|h[1-6]|table|ul|ol|section|blockquote)\s*>/gi, '\n')
  t = t.replace(/<[^>]*>/g, ' ')
  t = t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' '
    }
    return ENTITIES[e.toLowerCase()] !== undefined ? ENTITIES[e.toLowerCase()] : m
  })
  return linesOf(t)
}
function linesOf(text) {
  return String(text || '').replace(/\r/g, '').split('\n').map(l => l.replace(/[ \s]+/g, ' ').trim()).filter(Boolean)
}
// The lines the reader works on: the HTML version when there is one (its cells are predictable), else the plain text the mail system made.
export function bodyLines(email) {
  const e = email || {}
  const fromHtml = e.html ? htmlToLines(e.html) : []
  return fromHtml.length >= 3 ? fromHtml : linesOf(e.text)
}

// ── DATES ─────────────────────────────────────────────────────────────────
// One date in whichever way an email writes it. Day first for a numeric one (an Indian villa's mail). '' when there is none.
export function dateInWords(text) {
  const s = String(text || '')
  let m = /\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/.exec(s)
  if (m) return ymd(+m[1], +m[2], +m[3])
  m = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(20\d\d)\b/.exec(s)
  if (m && monthOf(m[2])) return ymd(+m[3], monthOf(m[2]), +m[1])
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d\d)\b/.exec(s)
  if (m && monthOf(m[1])) return ymd(+m[3], monthOf(m[1]), +m[2])
  m = /\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d\d)\b/.exec(s)
  if (m) return ymd(+m[3], +m[2], +m[1])
  return ''
}

// The stay's dates as a subject words them: "New booking confirmed for 5 - 6 Dec 2026", "30 Nov - 2 Dec 2026", "31 Dec 2026 - 2 Jan 2027".
// null when the subject has no such span.
export function datesInSubject(subject) {
  const m = /\b(\d{1,2})(?:\s+([A-Za-z]{3,9}))?(?:\s+(20\d\d))?\s*[-–—]\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(20\d\d)\b/.exec(String(subject || ''))
  if (!m) return null
  const endMonth = monthOf(m[5]), startMonth = m[2] ? monthOf(m[2]) : endMonth
  if (!endMonth || !startMonth) return null
  const endYear = +m[6]
  const startYear = m[3] ? +m[3] : (startMonth > endMonth ? endYear - 1 : endYear)
  const checkIn = ymd(startYear, startMonth, +m[1]), checkOut = ymd(endYear, endMonth, +m[4])
  return checkIn && checkOut ? { checkIn, checkOut } : null
}

// ── LABELS AND THEIR VALUES ───────────────────────────────────────────────
// The value that goes with a label, in whichever of the three ways a mail shows it:
//   1. on the same line after a colon                 "Check-in: 2026-12-05"
//   2. on the next line                               "Check-in" / "2026-12-05"
//   3. in a row of values after a row of labels       "Booking ID" "Check-in" "Check-out" / "2071015532" "2026-12-05" "2026-12-06"
// `known` is every label of the platform (normalised), so a run of labels can be told from a label with its value after it.
function valueOf(lines, wanted, known) {
  const isLabel = i => i >= 0 && i < lines.length && known.has(norm(lines[i]))
  for (let i = 0; i < lines.length; i++) {
    const n = norm(lines[i])
    for (const w of wanted) {
      if (n.startsWith(w + ':')) {                                  // 1. same line
        const rest = lines[i].slice(lines[i].indexOf(':') + 1).trim()
        if (rest) return rest
      }
      if (n !== w) continue
      // The run of labels this label is in (just itself, or a row of them): looked at in BOTH directions, because the last label of a row has
      // a value-looking line after it, and mistaking that for its own value is exactly the mistake to avoid.
      let first = i, last = i
      while (isLabel(first - 1)) first--
      while (isLabel(last + 1)) last++
      if (first === last) return i + 1 < lines.length ? lines[i + 1] : ''   // 2. a lone label: its value is the next line
      // 3. a row of labels: one value each, in the same order, right after the row. A row of values that is short, or has a label among it, is not
      // guessed at (the caller then falls back on what each value looks like).
      const count = last - first + 1
      const values = lines.slice(last + 1, last + 1 + count)
      if (values.length < count || values.some((_, k) => isLabel(last + 1 + k))) return ''
      return values[i - first]
    }
  }
  return ''
}

// "INR 6,700.00", "6,700.00 INR", "₹6,700" -> { amount: 6700, currency: 'INR' }; amount 0 when there is no number.
function moneyIn(text) {
  const s = String(text || '')
  const num = /(\d[\d,]*(?:\.\d+)?)/.exec(s)
  if (!num) return { amount: 0, currency: '' }
  const code = /\b([A-Z]{3})\b/.exec(s)
  const currency = code ? code[1] : (/₹|Rs\.?/i.test(s) ? 'INR' : '')
  const amount = parseFloat(num[1].replace(/,/g, ''))
  return { amount: Number.isFinite(amount) ? amount : 0, currency }
}

// ── THE BOOKING IN AN EMAIL ───────────────────────────────────────────────
// email = { subject, text, html }; spec = the partner's `email` block ({ labels, ... }).
// -> { ok, bookingId, checkIn, checkOut, nights, total, currency, adults, children, rooms, guestName, country, missing: [], problem: '' }
// ok needs a booking id and a check-in and check-out that make sense (the booking can then be told apart and the nights held); everything else is
// best effort, because a booking whose guest name could not be read must still hold its nights. A date pair that disagrees with the one in the
// subject is not trusted (problem 'dates_disagree'): reading the wrong nights would be worse than asking the owner.
export function parseBookingEmail(email, spec, opts) {
  // What the email must give for ok: a new booking needs the id and both dates; a cancellation or a change is found by its id alone (opts.need).
  const need = (opts && Array.isArray(opts.need)) ? opts.need : ['bookingId', 'checkIn', 'checkOut']
  const e = email || {}
  const labels = (spec && spec.labels) || {}
  const lines = bodyLines(e)
  const known = new Set(Object.values(labels).flat().map(norm))
  const want = key => (Array.isArray(labels[key]) ? labels[key] : []).map(norm)
  const val = key => valueOf(lines, want(key), known)

  // booking id: the value after its label, else a line that is only a long number, else the first long number in the text
  let bookingId = ''
  const idText = val('bookingId')
  const idMatch = /\b\d{8,12}\b/.exec(idText)
  if (idMatch) bookingId = idMatch[0]
  if (!bookingId) { const only = lines.find(l => /^\d{8,12}$/.test(l)); if (only) bookingId = only }
  if (!bookingId) { const any = /\b\d{9,12}\b/.exec(lines.join('\n')); if (any) bookingId = any[0] }

  // dates: the values after their labels, else the first two dates in the text, else the subject's own
  const inWords = datesInSubject(e.subject)
  let checkIn = dateInWords(val('checkIn')), checkOut = dateInWords(val('checkOut'))
  if (!checkIn || !checkOut) {
    const found = []
    for (const l of lines) { const d = dateInWords(l); if (d && !found.includes(d)) found.push(d) }
    if (!checkIn && found[0]) checkIn = found[0]
    if (!checkOut) checkOut = found.find(d => d > (checkIn || '')) || ''
  }
  if ((!checkIn || !checkOut) && inWords) { checkIn = checkIn || inWords.checkIn; checkOut = checkOut || inWords.checkOut }

  // price
  const price = moneyIn(val('total'))
  let { amount: total, currency } = price
  if (!total) { const anywhere = lines.map(moneyIn).find(m => m.amount > 0 && m.currency); if (anywhere) { total = anywhere.amount; currency = anywhere.currency } }

  // guests: "3 adults", "2 adults, 1 child"
  const guestsText = val('guests')
  const adultsM = /(\d+)\s*adult/i.exec(guestsText), childrenM = /(\d+)\s*child/i.exec(guestsText)
  let adults = adultsM ? +adultsM[1] : 0
  const children = childrenM ? +childrenM[1] : 0
  if (!adults && !children && /^\d+$/.test(guestsText.trim())) adults = +guestsText.trim()

  const rooms = val('rooms')
  let guestName = val('guestName')
  // A name has letters and no digits: "3 adults" would be a value from the wrong place (a layout that was not understood), never a name.
  if (!/[A-Za-z]/.test(guestName) || /\d/.test(guestName) || guestName.length > 80 || known.has(norm(guestName))) guestName = ''
  let country = val('country')
  if (known.has(norm(country)) || country.length > 60) country = ''

  const have = { bookingId, checkIn, checkOut }
  const missing = need.filter(k => !have[k])
  let problem = ''
  const both = !!(checkIn && checkOut)
  const nights = both ? daysBetween(checkIn, checkOut) : 0
  if (both && !(nights >= 1 && nights <= 90)) problem = 'dates_not_sensible'
  if (both && !problem && inWords && (inWords.checkIn !== checkIn || inWords.checkOut !== checkOut)) problem = 'dates_disagree'
  return {
    ok: missing.length === 0 && !problem,
    bookingId, checkIn, checkOut, nights: nights > 0 ? nights : 0,
    total, currency, adults, children, rooms, guestName: guestName.trim(), country: country.trim(),
    missing, problem,
  }
}

// ── IS THE SENDER GENUINE? ────────────────────────────────────────────────
// authResults = the mail system's own verdict (the Authentication-Results header the inbox adds: "dkim=pass ...; spf=pass ...; dmarc=pass ...").
// An email made up by anyone can say it is from a booking platform; this is the one thing in the message that says whether it really was. True only
// when there is a verdict and it is a clear NO (a failure, and not one single pass). No header at all is "cannot tell", which is not a refusal.
export function senderAuthFailed(authResults) {
  const a = String(authResults || '').toLowerCase()
  if (!a.trim()) return false
  // DMARC is the check that the signature or the sending server belongs to the address the mail SAYS it is from: a failure there is a refusal even
  // when some other check passed (a forger can sign with a domain of their own). A signature or server check failing on its own counts only when
  // nothing passed at all.
  if (/\bdmarc=fail\b/.test(a)) return true
  const passed = /\b(dkim|spf|dmarc)=pass\b/.test(a)
  const failedOne = /\bdkim=fail\b/.test(a) || /\bspf=(fail|softfail)\b/.test(a)
  return failedOne && !passed
}
