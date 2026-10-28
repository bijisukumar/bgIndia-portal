// The guests of a stay as names and ages (2026-10-27): what the check-in form captured, in a shape the owner can read. Pure and
// shared: the Worker builds the list (getStayGuests), the tests exercise it.
//
// The form has a free-text box, "Names of other guests in your group" ("Priya Nair, Karthik Nair (age 8), Meera Nair"), and, for
// a foreign party, a structured block per person with a date of birth. Both end up here.

// Age in whole years on `todayYmd` from a 'YYYY-MM-DD' date of birth; null when either is not a real date or the result is not a
// plausible age. Plain arithmetic on the parts, no Date: a time zone cannot move a birthday.
export function ageFromDob(dob, todayYmd) {
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob || ''))
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(todayYmd || ''))
  if (!b || !t) return null
  const by = +b[1], bm = +b[2], bd = +b[3]
  const ty = +t[1], tm = +t[2], td = +t[3]
  if (bm < 1 || bm > 12 || bd < 1 || bd > 31) return null
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age >= 0 && age < 120 ? age : null
}

// "8" for a child, "7 mo" for a baby under one, '' when the date is unusable.
export function ageLabelFromDob(dob, todayYmd) {
  const age = ageFromDob(dob, todayYmd)
  if (age == null) return ''
  if (age > 0) return String(age)
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob)), t = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(todayYmd))
  let months = (+t[1] - +b[1]) * 12 + (+t[2] - +b[2])
  if (+t[3] < +b[3]) months--
  return months > 0 ? `${months} mo` : '0'
}

const UNIT = '(months?|mos?|yrs?|years?|y|yo)'

// "Priya Nair, Karthik Nair (age 8), Meera 12 yrs; Anu - 5" -> [{ name, age, ageLabel }]. Items are split on commas, semicolons and
// new lines. An age is read from "(age 8)", "(8)", "(8 yrs)", "aged 8", or a trailing number ("Anu - 5", "Meera 12 yrs"); months
// ("6 months") give age 0 and the label "6 mo". A word like "and" is left alone, so "Mr and Mrs Nair" stays one item.
export function parseGuestList(text) {
  const out = []
  for (const raw of String(text || '').split(/[\n;,]+/)) {
    let name = raw.trim().replace(/^\s*(?:\d{1,2}[.)]|[-•*])\s+/, '')
    if (!name) continue
    let age = null, label = ''
    const take = (n, unit) => {
      const v = parseInt(n, 10)
      if (!(v >= 0 && v < 120) || age != null) return false
      if (unit && /^(m|mo)/i.test(unit)) { age = 0; label = `${v} mo` } else { age = v; label = String(v) }
      return true
    }
    name = name.replace(new RegExp(`[(\\[]\\s*(?:aged?\\s*[:\\-]?\\s*)?(\\d{1,3})\\s*${UNIT}?\\s*[)\\]]`, 'i'), (m, n, u) => (take(n, u) ? ' ' : m))
    if (age == null) name = name.replace(new RegExp(`\\baged?\\s*[:\\-]?\\s*(\\d{1,3})\\s*${UNIT}?\\b`, 'i'), (m, n, u) => (take(n, u) ? ' ' : m))
    if (age == null) {
      // a trailing number after a name ("Anu - 5", "Meera 12 yrs"); no look-behind, older Safari cannot parse one
      const t = new RegExp(`^(.*[A-Za-z.])[\\s,\\-–:]+(\\d{1,3})\\s*${UNIT}?\\s*$`, 'i').exec(name)
      if (t && take(t[2], t[3])) name = t[1]
    }
    name = name.replace(/\s+/g, ' ').replace(/[\s,\-–:]+$/, '').trim()
    if (!/\p{L}/u.test(name)) continue   // a name has at least one letter, in any script
    out.push({ name, age, ageLabel: label })
  }
  return out
}

// The people a check-in form names, each once: a foreign party's passport blocks when there are any (`kyc`: { name, nationality,
// dob }), otherwise the booking's guest, then whoever the free-text box lists. Ages are read on `onDate`: today for the owner's
// screen, the check-in date for the Drive record. The same person written twice ("Priya Nair" / "priya  nair") counts once.
export function collectGuests({ name, dob, kyc, guestList, onDate }) {
  const seen = new Set(), guests = []
  const keyOf = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const add = g => { const k = keyOf(g.name); if (!k || seen.has(k)) return; seen.add(k); guests.push(g) }
  if (kyc && kyc.length) {
    for (const k of kyc) add({ name: k.name, age: ageFromDob(k.dob, onDate), ageLabel: ageLabelFromDob(k.dob, onDate), nationality: k.nationality || null })
  } else {
    add({ name, age: ageFromDob(dob, onDate), ageLabel: ageLabelFromDob(dob, onDate) })
  }
  for (const g of parseGuestList(guestList)) add(g)
  return guests
}
