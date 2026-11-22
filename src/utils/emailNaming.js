// ============================================================
//  HOW THE OWNER'S EMAILS NAME THEMSELVES
//
//  Every message the owner gets from the system reads the same way in the inbox:
//
//      <emoji> <Brand> <Kind> — <what happened>
//
//      🚪 GVR Villa Log — Guest checked out: Adarsh C
//      💧 Estate360 Log — Irrigation logged (Pollachi Estate)
//      💧 Estate360 Weekly Report — Pollachi Estate: all on track, 0 expenses (₹0)
//      📋 Rental360 Reminder — Renew in 3 months: Pinnacle parking (...) ends 30 Jan 2027
//      ⚠️ GVR Villa Alert — Calendars out of step: ...
//
//  BRAND says which part of the business it is about:
//      villa     this host's villa, named in its own config (hosts/<id>/config.js, email.brands.villa; "GVR Villa" for Dwarka)
//      estate    the estates (Estate360)
//      rental    the rental properties (Rental360)
//      platform  the software itself: logins and security (bgIndia)
//  Any of the four can be overridden by the host the same way (email.brands.estate ...); one that is not set reads as the default below.
//
//  KIND says what sort of message it is:
//      Log        somebody made an entry (a check-in, an expense, an irrigation day, a harvest)
//      Report     a summary delivered on a schedule: Daily, Weekly or Monthly Report
//      Alert      something needs a look (a failed login, a calendar out of step, a possible double booking)
//      Reminder   something is coming up (a lease to renew, prices to check, an enquiry to follow up)
//
//  Pure functions, no I/O: the Worker uses them to name every alert (sendAlert takes the parts, see functions/api/[[route]].js), and the same
//  file names the owner mails that the Google scripts hand over, so changing a name never needs a script push.
// ============================================================

export const EMAIL_BRAND_DEFAULTS = { villa: 'Villa', estate: 'Estate360', rental: 'Rental360', platform: 'bgIndia' }

export const EMAIL_KINDS = {
  log: 'Log',
  alert: 'Alert',
  reminder: 'Reminder',
  report: 'Report',
  daily: 'Daily Report',
  weekly: 'Weekly Report',
  monthly: 'Monthly Report',
}

// The brand word for one domain: the host's own (config.email.brands[domain]) or the default.
export function emailBrand(domain, config) {
  const own = config && config.email && config.email.brands && config.email.brands[domain]
  const name = typeof own === 'string' ? own.trim() : ''
  return name || EMAIL_BRAND_DEFAULTS[domain] || EMAIL_BRAND_DEFAULTS.platform
}

// The whole subject. kind: 'log' | 'alert' | 'reminder' | 'report' | 'daily' | 'weekly' | 'monthly'. emoji is optional and goes first (as it always did).
// A kind this file does not know reads as an Alert: a typo must make a mail louder, never quieter.
export function ownerSubject({ domain, kind = 'log', text = '', emoji = '', config } = {}) {
  const lead = String(emoji || '').trim()
  const word = EMAIL_KINDS[kind] || EMAIL_KINDS.alert
  return `${lead ? lead + ' ' : ''}${emailBrand(domain, config)} ${word} — ${String(text).trim()}`
}

// What a summary of this many days is called when it is delivered on a schedule: 1 day = Daily, 7 = Weekly, a month (28 to 31) = Monthly,
// anything else is just a Report (the owner picked the dates).
export function reportKind(days) {
  const n = Number(days)
  if (n === 1) return 'daily'
  if (n === 7) return 'weekly'
  if (n >= 28 && n <= 31) return 'monthly'
  return 'report'
}

// ── The owner mails the Google scripts write ──
// The scripts compose their own subjects ("[GVR Portal] ✈️ New Airbnb booking ...", "Guest Check-in Received — ...", "🔔 Enquiry follow-up: ...") and
// hand the mail to the Worker with a category. These categories are the owner's own; every other category (a guest's mail) is left exactly as written.
export const RELAYED_OWNER_CATEGORIES = { owner_airbnb: 'log', owner_booking: 'log', enquiry_reminder: 'reminder' }

// "[GVR Portal] ✈️ New Airbnb booking" -> { emoji: '✈️', text: 'New Airbnb booking' }; the "[...]" tag the scripts put in front is dropped.
export function splitRelayedSubject(subject) {
  let s = String(subject || '').trim()
  s = s.replace(/^\[[^\]]{1,40}\]\s*/, '')
  const m = s.match(/^((?:[\p{Extended_Pictographic}\p{Emoji_Presentation}‍️⃣]+\s*)+)/u)
  return { emoji: m ? m[1].trim() : '', text: s.slice(m ? m[0].length : 0).trim() }
}

// The subject to send for a mail the Google scripts handed over. Only the owner categories above are renamed, and a subject that already starts
// with the brand is left alone, so naming it twice does no harm.
export function relayedOwnerSubject(subject, category, config) {
  const kind = RELAYED_OWNER_CATEGORIES[category]
  if (!kind) return subject
  const { emoji, text } = splitRelayedSubject(subject)
  if (!text) return subject
  if (text.startsWith(emailBrand('villa', config) + ' ')) return subject
  return ownerSubject({ domain: 'villa', kind, text, emoji, config })
}
