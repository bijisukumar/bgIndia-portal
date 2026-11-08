// ============================================================
//  WHAT A WEBSITE VISITOR'S REQUEST TELLS US, IN PLAIN WORDS
//
//  The website's estimate page (luxuryvillasofguruvayur.com/estimate) calls the app for a price and for a quote. Every call is written
//  to stayvibe_web_leads with what Cloudflare and the browser tell us about the visitor: city, state, country and time zone from the
//  connection, the browser string, the language list. Nothing here asks the visitor for anything and nothing new is stored: this file
//  only turns those stored values into the lines the owner reads on the enquiry, in the list and in the quote-request email.
//
//  Pure, and dependent only on utils/tz.js (the one home for time), so the Worker, the tests and any screen share it.
//
//  Honest limits, because the owner will act on these lines:
//   - The place is where the INTERNET CONNECTION is, not the phone's GPS: right for the country and usually the state; the city is right
//     for most home broadband and often the provider's nearest big city on mobile data. A VPN, an office network or iCloud Private Relay
//     shows another place. Some visitors have no city at all.
//   - Phone / tablet / computer comes from the browser string. An iPad that asks for the desktop site says it is a Mac, so it reads as
//     a Mac; there is no honest way to tell from the request alone.
//   - Opening inside Instagram or Facebook shows only for their own in-app browsers; a link opened in the normal browser leaves no trace.
// ============================================================
import { partsInZone, stampLong, stampShort, clock12, zoneAbbr, isZone, offsetMs, instantMs } from './tz.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 80)
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`

// ── the device ───────────────────────────────────────────────────────────
// Programs that fetch pages (search engines, link previews, scripts, monitors). A person's browser never says any of this.
const AUTOMATED = /bot\b|crawl|spider|slurp|facebookexternalhit|facebot|^whatsapp\/|headless|phantomjs|lighthouse|pingdom|uptime|python-|aiohttp|httpx|^curl\/|wget|libwww|go-http-client|^java\/|okhttp|httpclient|axios|node-fetch|undici|postman|insomnia|scrapy|semrush|ahrefs|mj12|petalbot|yandex|baidu|applebot|adsbot|mediapartners|feedfetcher|inspectiontool|gtmetrix|screaming frog|google web preview|slackbot|discordbot|skypeuripreview/i

// Browsers that live inside another app. The first match wins (Messenger carries Facebook's tokens too).
const IN_APPS = [
  [/Instagram/, 'Instagram'],
  [/Messenger|Orca-Android/, 'Messenger'],
  [/FBAN|FBAV|FB_IAB|FBIOS|FBDV|FB4A/, 'Facebook'],
  [/\bLine\//, 'Line'],
  [/Snapchat/i, 'Snapchat'],
  [/Twitter/i, 'X (Twitter)'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/Pinterest/i, 'Pinterest'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/GSA\//, 'Google'],
  [/Telegram/i, 'Telegram'],
]

const KIND_LABEL = { phone: 'Mobile', tablet: 'Tablet', desktop: 'Desktop', tv: 'TV', bot: 'Automated', unknown: 'Unknown device' }
const KIND_ICON = { phone: '📱', tablet: '📱', desktop: '💻', tv: '📺', bot: '🤖', unknown: '❔' }

function browserOf(ua) {
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return 'Edge'
  if (/OPR\/|OPiOS|OPT\/|Opera/.test(ua)) return 'Opera'
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet'
  if (/UCBrowser|UCWEB/.test(ua)) return 'UC Browser'
  if (/MiuiBrowser/.test(ua)) return 'Mi Browser'
  if (/VivoBrowser/.test(ua)) return 'Vivo Browser'
  if (/HeyTapBrowser|OppoBrowser/.test(ua)) return 'Oppo Browser'
  if (/HuaweiBrowser/.test(ua)) return 'Huawei Browser'
  if (/Vivaldi/.test(ua)) return 'Vivaldi'
  if (/DuckDuckGo/.test(ua)) return 'DuckDuckGo'
  if (/FxiOS|Firefox\//.test(ua)) return 'Firefox'
  if (/CriOS|Chrome\/|Chromium\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return null
}

function build(kind, model, browser, app, bot) {
  const parts = [KIND_LABEL[kind]]
  if (kind === 'bot') return { kind, kindLabel: KIND_LABEL.bot, model: '', browser: null, app: null, bot: true, icon: KIND_ICON.bot, text: 'Automated visitor' }
  if (model) parts.push(model)
  if (app) parts.push(app === 'an app' ? 'inside another app' : `${app} app`)
  else if (browser) parts.push(browser)
  return { kind, kindLabel: KIND_LABEL[kind], model: model || '', browser: browser || null, app: app || null, bot: !!bot, icon: KIND_ICON[kind], text: kind === 'unknown' ? KIND_LABEL.unknown : parts.join(' · ') }
}

// userAgent -> { kind: phone|tablet|desktop|tv|bot|unknown, kindLabel, model, browser, app, bot, icon, text }
// text reads like "Mobile · iPhone · Safari" or "Mobile · Android phone · Instagram app".
export function describeDevice(userAgent) {
  const ua = String(userAgent == null ? '' : userAgent).slice(0, 600).replace(/cubot/gi, '')   // a phone brand that spells "bot"
  if (!ua.trim()) return build('unknown')
  if (AUTOMATED.test(ua)) return build('bot', '', null, null, true)

  let kind = 'unknown', model = ''
  if (/SMART-TV|SmartTV|Tizen|Web0S|HbbTV|AppleTV|CrKey|Roku/i.test(ua)) { kind = 'tv'; model = 'Smart TV' }
  else if (/iPhone|iPod/.test(ua)) { kind = 'phone'; model = /iPod/.test(ua) ? 'iPod' : 'iPhone' }
  else if (/iPad/.test(ua)) { kind = 'tablet'; model = 'iPad' }
  else if (/Silk\/|Kindle/.test(ua)) { kind = 'tablet'; model = 'Fire tablet' }
  else if (/Android/.test(ua)) { kind = /Mobile/.test(ua) ? 'phone' : 'tablet'; model = kind === 'phone' ? 'Android phone' : 'Android tablet' }
  else if (/Windows Phone|IEMobile/.test(ua)) { kind = 'phone'; model = 'Windows phone' }
  else if (/CrOS/.test(ua)) { kind = 'desktop'; model = 'Chromebook' }
  else if (/Windows/.test(ua)) { kind = 'desktop'; model = 'Windows PC' }
  else if (/Macintosh|Mac OS X/.test(ua)) { kind = 'desktop'; model = 'Mac' }
  else if (/Linux|X11|Ubuntu|Fedora|Debian/.test(ua)) { kind = 'desktop'; model = 'Linux PC' }
  else if (/Mobi/.test(ua)) { kind = 'phone'; model = 'Phone' }

  let app = null
  for (const [re, name] of IN_APPS) if (re.test(ua)) { app = name; break }
  const apple = /iPhone|iPad|iPod/.test(ua)
  // an app's own window: no "Safari" on Apple devices, "; wv)" on Android
  if (!app && apple && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) app = 'an app'
  if (!app && /; wv\)/.test(ua)) app = 'an app'
  return build(kind, model, browserOf(ua), app, false)
}

// ── the language ─────────────────────────────────────────────────────────
let languageNames = null
const languageLabel = tag => {
  try {
    if (!languageNames) languageNames = new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' })
    return languageNames.of(tag) || tag
  } catch { return tag }
}

// The Accept-Language header -> "English (India), Malayalam": the languages the visitor's browser prefers, best first, one per
// language (en-IN, en and en-US read as one English), at most `max`. '' when there is none.
export function describeLanguages(header, max = 3) {
  const tags = String(header == null ? '' : header).slice(0, 300).split(',').map((part, i) => {
    const [tag, ...params] = part.trim().split(';')
    const q = params.map(p => /^\s*q=([0-9.]+)/.exec(p)).find(Boolean)
    return { tag: tag.trim(), q: q ? Number(q[1]) : 1, i }
  }).filter(t => /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(t.tag) && t.q > 0)
  tags.sort((a, b) => b.q - a.q || a.i - b.i)
  const seen = new Set(), out = []
  for (const t of tags) {
    const lang = t.tag.split('-')[0].toLowerCase()
    if (seen.has(lang)) continue
    seen.add(lang)
    out.push(languageLabel(t.tag))
    if (out.length >= max) break
  }
  return out.join(', ')
}

// ── the place ────────────────────────────────────────────────────────────
let regionNames = null
export function countryName(code) {
  const c = String(code == null ? '' : code).trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1') return ''   // XX: unknown, T1: Tor
  try {
    if (!regionNames) regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
    const n = regionNames.of(c)
    return n && n !== c ? n : c
  } catch { return c }
}

// { city, region, country } -> "Chennai, Tamil Nadu, India" ('' when nothing is known; a city that is also the state is said once)
export function placeText(row) {
  const city = clean(row && row.city), region = clean(row && row.region)
  const parts = []
  if (city) parts.push(city)
  if (region && region.toLowerCase() !== city.toLowerCase()) parts.push(region)
  const country = countryName(row && row.country)
  if (country) parts.push(country)
  return parts.join(', ')
}

// ── the time ─────────────────────────────────────────────────────────────
export function dayPart(hour) {
  const h = Number(hour)
  if (!Number.isFinite(h)) return ''
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  if (h >= 21) return 'night'
  return 'late night'
}

// When the visit happened, as the visitor's own clock read (their time zone comes from the connection) and as the villa's clock.
// `at` is a stored UTC instant. zoneKnown false = the connection named no usable zone, so only the villa's clock is honest.
export function visitTimes(at, visitorZone, propertyZone, now = Date.now()) {
  const ms = instantMs(at)
  if (!Number.isFinite(ms)) return null
  const zoneKnown = isZone(visitorZone)
  const theirZone = zoneKnown ? String(visitorZone).trim() : null
  const parts = partsInZone(ms, theirZone || propertyZone)
  const differs = zoneKnown && offsetMs(ms, theirZone) !== offsetMs(ms, propertyZone)
  return {
    zoneKnown,
    theirs: zoneKnown ? stampLong(ms, theirZone) : null,
    part: parts ? dayPart(parts.h) : '',
    atVilla: stampLong(ms, propertyZone),
    differs,
    nowTheirs: differs ? `${clock12(now, theirZone)} ${zoneAbbr(theirZone, now)}` : null,
  }
}

// ── what they looked at first ────────────────────────────────────────────
const dayMonth = ymd => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}` : ''
}
const rupees = n => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`

// The visitor's earlier price checks (rows of kind 'search'), one line per distinct dates-and-party, newest first.
export function summariseLookups(rows, propertyZone) {
  const groups = new Map()
  let total = 0, first = null
  for (const r of rows || []) {
    if (!r || !r.checkin_date || !r.checkout_date) continue
    total++
    if (!first || r.created_at < first) first = r.created_at
    const key = [r.checkin_date, r.checkout_date, r.adults || 0, r.children || 0].join('|')
    const g = groups.get(key)
    if (g) { g.times++; g.last = r.created_at; g.available = r.available; g.approxTotal = r.approx_total }
    else groups.set(key, { checkIn: r.checkin_date, checkOut: r.checkout_date, adults: r.adults || 0, children: r.children || 0, available: r.available, approxTotal: r.approx_total, times: 1, last: r.created_at })
  }
  const all = [...groups.values()].sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
  const items = all.slice(0, 6).map(g => {
    const party = [g.adults ? plural(g.adults, 'adult') : '', g.children ? plural(g.children, 'child', 'children') : ''].filter(Boolean).join(' + ')
    const text = [
      `${dayMonth(g.checkIn)} → ${dayMonth(g.checkOut)}`, party,
      g.available == null ? '' : (Number(g.available) ? 'free' : 'not free'),
      g.approxTotal ? `about ${rupees(g.approxTotal)}` : '',
      g.times > 1 ? `checked ${g.times} times` : '',
    ].filter(Boolean).join(' · ')
    return { checkIn: g.checkIn, checkOut: g.checkOut, adults: g.adults, children: g.children, available: g.available, approxTotal: g.approxTotal, times: g.times, text }
  })
  return { total, distinct: all.length, since: first ? stampShort(first, propertyZone) : '', items, more: Math.max(0, all.length - items.length) }
}

// ── everything together ──────────────────────────────────────────────────
// lead: the stayvibe_web_leads row of the quote request; repeats: how many times the same request was sent again; lookups: that
// visitor's earlier 'search' rows; propertyZone: the villa's zone. Returns null when there is no lead.
// `facts` is the ready-to-print list ({key, icon, label, value, warn?, lines?}) that the enquiry screen and the owner's email both
// render, so the two can never disagree about what they say.
export function buildWebVisit({ lead, repeats = 0, lookups = [], propertyZone, now = Date.now() }) {
  if (!lead) return null
  const device = describeDevice(lead.user_agent)
  const place = placeText(lead)
  const when = visitTimes(lead.created_at, lead.timezone, propertyZone, now)
  const languages = describeLanguages(lead.language)
  const history = summariseLookups(lookups, propertyZone)
  const via = lead.status === 'duplicate' ? 'duplicate' : 'created'

  const facts = []
  if (via === 'duplicate') facts.push({ key: 'via', icon: '↻', label: 'Website', value: 'The guest also sent a request from the website for these dates (no second enquiry was made)' })
  if (place) facts.push({ key: 'from', icon: '📍', label: 'From', value: place })
  facts.push({ key: 'device', icon: device.icon, label: 'Device', value: device.text, warn: device.bot ? 'probably not a person' : '' })
  if (when) {
    facts.push({ key: 'visited', icon: '🕐', label: when.zoneKnown ? 'Their time' : 'At the villa', value: `${when.zoneKnown ? when.theirs : when.atVilla} · ${when.part}` })
    if (when.differs) facts.push({ key: 'villa', icon: '🏡', label: 'At the villa', value: when.atVilla })
    if (when.nowTheirs && now - instantMs(lead.created_at) > 10 * 60000) facts.push({ key: 'now', icon: '⏱', label: 'Their time now', value: when.nowTheirs })
  }
  if (languages) facts.push({ key: 'language', icon: '🗣', label: 'Language', value: languages })
  if (history.total) {
    facts.push({
      key: 'lookups', icon: '🔎', label: 'Before asking',
      value: `Checked prices ${history.total === 1 ? 'once' : history.total + ' times'} first${history.since ? ', since ' + history.since : ''}`,
      lines: [...history.items.map(i => i.text), ...(history.more ? [`+ ${history.more} more date${history.more > 1 ? 's' : ''}`] : [])],
    })
  }
  if (repeats > 0) facts.push({ key: 'again', icon: '↻', label: 'Asked again', value: `Sent the same request ${repeats === 1 ? 'once more' : repeats + ' more times'}` })

  return { via, at: lead.created_at, place, city: clean(lead.city), device, when, languages, lookups: history, askedAgain: repeats, facts }
}

// The small chip on the enquiry list: where, and phone or computer.
export function webVisitChip(row) {
  const d = describeDevice(row && row.user_agent)
  return { city: clean(row && row.city), place: placeText(row || {}), kind: d.kind, icon: d.icon, bot: d.bot }
}
