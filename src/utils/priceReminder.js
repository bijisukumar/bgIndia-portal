// ============================================================
//  THE "LOOK AT YOUR PRICES" REMINDER EMAIL
//
//  StayVibe keeps the villa's price list (Rates & seasons). The booking sites (Airbnb, VRBO, Agoda ...) take prices only from the host
//  or from a certified channel manager, never through a calendar link (a link carries dates, not prices), so the prices on them are
//  changed by hand. What goes wrong is quiet: months pass, a festival season arrives, and a site still shows last year's price. So,
//  every quarter, the owner gets ONE email: look at your prices on <these sites> for the next N months; here is what your price list
//  says; here is the link to it. It asks for a look, it changes nothing.
//
//  Per customer, in hosts/<id>/config.js:
//    priceReminder: { horizonMonths: 6, everyMonths: 3, platforms: ['airbnb', 'vrbo', 'agoda'] }
//      horizonMonths  how far ahead the owner is asked to have prices set: 3 or 6 (any 1..12 works). Default 6.
//      everyMonths    how often the email comes, counted from the start of the year: 3 = Jan, Apr, Jul, Oct (one that divides 12:
//                     1, 2, 3, 4, 6 or 12). Default 3.
//      platforms      partner ids (partners/*.js) the email names; the NAMES come from the partner files, none is written here.
//    A host with no `priceReminder` is not emailed; `enabled: false` switches it off.
//
//  Pure (utils/tz.js and utils/seasonRates.js only): the Worker reads the database and sends, this file decides and words.
// ============================================================
import { isYmd, addDaysYmd, seasonCoversNight, seasonPriceLabel, seasonDatesLabel } from './seasonRates.js'
import { wallToStamp } from './tz.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/
const pad2 = n => String(n).padStart(2, '0')
const EVERY_CHOICES = [1, 2, 3, 4, 6, 12]   // the ones that divide a year evenly, so "the start of this period" and "the next" always agree

export const PRICE_REMINDER_DEFAULTS = Object.freeze({ horizonMonths: 6, everyMonths: 3 })

const whole = (v, lo, hi, dflt) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt
}

// The host's config -> { enabled, horizonMonths, everyMonths, platforms: [partner ids] }.
export function priceReminderSettings(config) {
  const c = config && config.priceReminder
  if (!c || typeof c !== 'object' || c.enabled === false) return { enabled: false, horizonMonths: 0, everyMonths: 0, platforms: [] }
  const seen = new Set()
  const platforms = (Array.isArray(c.platforms) ? c.platforms : [])
    .map(p => String(p == null ? '' : p).trim().toLowerCase())
    .filter(p => p && !seen.has(p) && seen.add(p))
    .slice(0, 12)
  const every = whole(c.everyMonths, 1, 12, PRICE_REMINDER_DEFAULTS.everyMonths)
  return {
    enabled: true,
    horizonMonths: whole(c.horizonMonths, 1, 12, PRICE_REMINDER_DEFAULTS.horizonMonths),
    everyMonths: EVERY_CHOICES.includes(every) ? every : PRICE_REMINDER_DEFAULTS.everyMonths,
    platforms,
  }
}

// ── dates ────────────────────────────────────────────────────────────────
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()   // m is 1..12

// 'YYYY-MM-DD' plus n whole months; the day is kept, or the month's last day when it has none (31 Aug + 6 months = 28 Feb).
export function addMonthsYmd(ymd, n) {
  const m = YMD.exec(String(ymd || ''))
  if (!m || !isYmd(ymd)) return ''
  const total = (+m[1]) * 12 + (+m[2] - 1) + Math.trunc(Number(n) || 0)
  const y = Math.floor(total / 12), mo = total - y * 12 + 1
  return `${y}-${pad2(mo)}-${pad2(Math.min(+m[3], daysIn(y, mo)))}`
}

// The first day of the period that contains `today` ('2026-11-08', every 3 months -> '2026-10-01').
export function periodStart(todayYmd, everyMonths) {
  const m = YMD.exec(String(todayYmd || ''))
  if (!m || !isYmd(todayYmd)) return ''
  const every = whole(everyMonths, 1, 12, PRICE_REMINDER_DEFAULTS.everyMonths)
  const first = Math.floor((+m[2] - 1) / every) * every + 1
  return `${m[1]}-${pad2(first)}-01`
}

// The first day of the NEXT period ('2026-11-08', every 3 -> '2027-01-01').
export function nextPeriodStart(todayYmd, everyMonths) {
  const s = periodStart(todayYmd, everyMonths)
  return s ? addMonthsYmd(s, whole(everyMonths, 1, 12, PRICE_REMINDER_DEFAULTS.everyMonths)) : ''
}

// When this period began, as the stored UTC stamp ('YYYY-MM-DD HH:MM:SS') of midnight at the property: what a log row's
// created_at is compared with to answer "was this period's reminder already sent?".
export function periodStartStamp(todayYmd, everyMonths, zone) {
  const s = periodStart(todayYmd, everyMonths)
  return s ? wallToStamp(s, '00:00', zone) : ''
}

// The stretch the owner is asked to have prices set for: today up to today + N months.
export function reminderWindow(todayYmd, horizonMonths) {
  return { from: todayYmd, to: addMonthsYmd(todayYmd, whole(horizonMonths, 1, 12, PRICE_REMINDER_DEFAULTS.horizonMonths)) }
}

// The seasons (rows from the Rates page, active ones) that cover at least one night between from and to.
export function seasonsInWindow(seasons, from, to) {
  if (!isYmd(from) || !isYmd(to) || to < from) return []
  const nights = []
  for (let d = from; d <= to && nights.length < 400; d = addDaysYmd(d, 1)) nights.push(d)
  return (Array.isArray(seasons) ? seasons : []).filter(s => s && nights.some(n => seasonCoversNight(s, n)))
}

// ── the price list in a sentence ─────────────────────────────────────────
// rows [{ guests, tariff }] or the database's { guest_count, tariff_per_night } -> the cheapest and the dearest party, or null.
export function cardSummary(rateCard) {
  const rows = (Array.isArray(rateCard) ? rateCard : [])
    .map(r => ({ guests: Number(r && (r.guests ?? r.guest_count)), tariff: Number(r && (r.tariff ?? r.tariff_per_night)) }))
    .filter(r => r.guests > 0 && r.tariff > 0)
    .sort((a, b) => a.guests - b.guests)
  if (!rows.length) return null
  const low = rows[0], high = rows[rows.length - 1]
  const same = rows.filter(r => r.tariff === low.tariff).map(r => r.guests)
  return { lowTariff: low.tariff, lowGuests: [Math.min(...same), Math.max(...same)], highTariff: high.tariff, highGuests: high.guests }
}

const rupees = n => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`
const guestsText = ([a, b]) => (a === b ? `${a} guest${a === 1 ? '' : 's'}` : `${a}–${b} guests`)
const dateLong = ymd => { const m = YMD.exec(String(ymd || '')); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : '' }
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const joinNames = names => (names.length <= 1 ? (names[0] || '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)
const everyText = n => (n === 1 ? 'every month' : n === 12 ? 'every year' : `every ${n} months`)

function priceLine(card) {
  if (!card) return 'Your price list has no regular prices yet: set them in Rates & seasons first.'
  const low = `${rupees(card.lowTariff)} a night for ${guestsText(card.lowGuests)}`
  if (card.highTariff === card.lowTariff) return `Regular price: ${low}.`
  return `Regular price: ${low}, up to ${rupees(card.highTariff)} for ${card.highGuests} guests.`
}

const NO_SEASONS = 'No seasons are set for this period. If a festival or busy time needs a higher price, add it in Rates & seasons first, then set it on the sites.'

// Everything the email says. labels: the platforms' names ('Airbnb', 'VRBO' ...); today: the property's date; seasons: active rows;
// rateCard: the base card; link: where Rates & seasons opens ('' = no link); time: a printed time for the footer ('' = none).
// -> { subject, lines (plain text), html }
export function buildPriceReminder({ labels = [], today, horizonMonths = 6, everyMonths = 3, seasons = [], rateCard = [], link = '', time = '' }) {
  const win = reminderWindow(today, horizonMonths)
  const sites = joinNames((labels || []).filter(Boolean)) || 'your booking sites'
  const months = `${horizonMonths} month${horizonMonths === 1 ? '' : 's'}`
  const until = dateLong(win.to)
  const next = dateLong(nextPeriodStart(today, everyMonths))
  const inWindow = seasonsInWindow(seasons, win.from, win.to)
  const seasonLines = inWindow.map(s => `${s.name}: ${seasonDatesLabel(s)} (${seasonPriceLabel(s)})`)
  const price = priceLine(cardSummary(rateCard))
  const ask = `Open ${sites} and make sure your nightly prices and open dates cover the next ${months}${until ? ` (until ${until})` : ''}, and match your price list in StayVibe. Use the same price as your direct price on every site.`
  const footer = `You get this reminder ${everyText(everyMonths)}${next ? ` (next: ${next})` : ''}. To change how far ahead it asks you to look, or which sites it names, ask us: it is a setting for your property.`

  const subject = `🗓️ Time to check your prices on ${sites} (next ${months})`
  const lines = [
    'Source: Price check',
    `Action: ${ask}`,
    '',
    'Your price list says:',
    `• ${price}`,
    ...(seasonLines.length ? ['• Seasons in this period:', ...seasonLines.map(l => `    - ${l}`)] : [`• ${NO_SEASONS}`]),
    '',
    ...(link ? [`Open your price list: ${link}`, ''] : []),
    footer,
    ...(time ? [`Time: ${time}`] : []),
  ]

  const row = (html) => `<div style="margin:0 0 6px">${html}</div>`
  const button = link
    ? `<div style="margin-bottom:18px"><a href="${esc(link)}" style="display:inline-block;background:#C9A84C;color:#111827;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:999px">Open your price list &rarr;</a></div>`
    : ''
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
  <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9a7b1f;font-weight:700">Price check</div>
  <div style="font-size:22px;font-weight:700;margin:6px 0 8px">Time to check your prices on ${esc(sites)}</div>
  <div style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:18px">${esc(ask)}</div>
  ${button}
  <div style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:12px 0;margin-bottom:14px;font-size:14px;line-height:1.6">
    <div style="font-weight:700;margin-bottom:6px">Your price list says</div>
    ${row(esc(price))}
    ${seasonLines.length
      ? row('Seasons in this period:<div style="color:#374151;margin-top:2px">' + seasonLines.map(esc).join('<br>') + '</div>')
      : row(`<span style="color:#b45309">${esc(NO_SEASONS)}</span>`)}
  </div>
  <div style="font-size:12px;color:#9ca3af;line-height:1.6">${esc(footer)}${time ? '<br>' + esc(time) : ''}</div>
</div>`

  return { subject, lines, html, window: win, seasonCount: inWindow.length }
}
