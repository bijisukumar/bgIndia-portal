// ============================================================
//  LEASE RENEWAL: how long is left on a lease, and what to do about it
//
//  The Rev360 home shows beside every lease "(7 months to renew)": yellow when 3 months are left, red when 2 or fewer (or the lease is
//  already over). The same rule fills its "To do · renewals" block, and sends the reminder emails 3, 2 and 1 month before a lease ends.
//  The Worker reads the database and sends; this file decides and words. Pure (one date helper from priceReminder.js).
//
//  "Months to renew" counts whole calendar months from today to the last day of the lease, ROUNDED UP: 2 months and 16 days left reads
//  "3 months". So a lease has N months left when it ends on or before today + N months but not on or before today + (N-1) months, and the
//  N-month email is due at exactly that moment: yellow means the 3-month email has gone out, red that the 2-month one has. Inside the last
//  month it counts days instead.
//
//  Per customer, in hosts/<id>/config.js:
//    leaseReminder: { monthsBefore: [3, 2, 1] }     which marks send an email (1..12 months, default 3, 2 and 1); `enabled: false` switches it off
//  A host with no `leaseReminder` is not emailed (the screen's label and colours do not depend on it).
// ============================================================
import { addMonthsYmd } from './priceReminder.js'

export const LEASE_REMINDER_DEFAULTS = Object.freeze({ monthsBefore: [3, 2, 1] })
export const YELLOW_AT_MONTHS = 3   // exactly this many months left: yellow
export const RED_AT_MONTHS = 2      // this many or fewer (or the lease is over): red

const YMD = /^(\d{4})-(\d{2})-(\d{2})/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const dayNumber = ymd => { const m = YMD.exec(String(ymd || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN }
const day10 = v => String(v || '').slice(0, 10)

// '2027-01-30' -> '30 Jan 2027' ('' when it is not a date)
export function ymdLabel(ymd) {
  const m = YMD.exec(String(ymd || ''))
  return m ? `${m[3]} ${MONTHS[+m[2] - 1] || ''} ${m[1]}` : ''
}

// The lease's last day and today -> where it stands, or null when either is not a date.
//   { end, days, months, over, tone: 'red' | 'yellow' | 'none', label }
export function renewalStatus(endYmd, todayYmd) {
  const end = day10(endYmd), today = day10(todayYmd)
  if (!YMD.test(end) || !YMD.test(today)) return null
  const days = Math.round(dayNumber(end) - dayNumber(today))
  if (days < 0) return { end, days, months: 0, over: true, tone: 'red', label: `ended ${plural(-days, 'day')} ago` }
  if (days === 0) return { end, days, months: 0, over: false, tone: 'red', label: 'ends today' }
  let months = 1
  while (months < 240 && end > addMonthsYmd(today, months)) months++
  const tone = months <= RED_AT_MONTHS ? 'red' : months === YELLOW_AT_MONTHS ? 'yellow' : 'none'
  return { end, days, months, over: false, tone, label: months === 1 ? `${plural(days, 'day')} to renew` : `${months} months to renew` }
}

// A tenancy that is running (the same notion as the home's "Active leases" count: stage Active, or Signed Up, not behind on rent).
export function isActiveTenancy(p) {
  const stage = (p && (p.stage || p.status)) || 'Active'
  return (stage === 'Active' || stage === 'Signed Up') && !(p && p.is_delinquent) && !(p && p.early_terminated)
}

// The leases a property row carries: the main one and, when the parking is let on its own, the parking lease.
export function leaseTerms(p) {
  if (!p) return []
  const out = []
  if (day10(p.lease_end) && p.tenant_name) {
    out.push({ unit: 'lease', who: p.tenant_name, start: day10(p.lease_start), end: day10(p.lease_end),
      fee: Number(p.agreed_rent || p.monthly_rent) || 0, currency: p.currency || 'INR', monthToMonth: !!p.is_month_to_month })
  }
  if (p.has_separate_parking && day10(p.parking_lease_end) && (p.parking_tenant_name || Number(p.parking_fee))) {
    out.push({ unit: 'parking', who: p.parking_tenant_name || '', start: day10(p.parking_lease_start), end: day10(p.parking_lease_end),
      fee: Number(p.parking_fee) || 0, currency: p.parking_currency || p.currency || 'INR', monthToMonth: false })
  }
  return out
}

// What needs a renewal decision now or soon: every running lease in the yellow or red zone (or already over), soonest first.
export function renewalTodos(properties, todayYmd) {
  const out = []
  for (const p of properties || []) {
    if (!isActiveTenancy(p)) continue
    for (const t of leaseTerms(p)) {
      if (t.monthToMonth) continue
      const s = renewalStatus(t.end, todayYmd)
      if (!s || s.tone === 'none') continue
      out.push({ propId: p.prop_id, name: p.name || '', location: p.location || '', country: p.country || 'IN', ...t, ...s })
    }
  }
  return out.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : (a.unit < b.unit ? -1 : 1)))
}

// The marks (months before the end) that send an email, from the host's config; { enabled: false } for a host that did not ask.
export function leaseReminderSettings(config) {
  const c = config && config.leaseReminder
  if (!c || typeof c !== 'object' || c.enabled === false) return { enabled: false, monthsBefore: [] }
  const list = Array.isArray(c.monthsBefore) ? c.monthsBefore : LEASE_REMINDER_DEFAULTS.monthsBefore
  const marks = [...new Set(list.map(n => Math.floor(Number(n))).filter(n => Number.isFinite(n) && n >= 1 && n <= 12))].sort((a, b) => b - a)
  return { enabled: true, monthsBefore: marks.length ? marks : [...LEASE_REMINDER_DEFAULTS.monthsBefore] }
}

// Reminders due today: for each running lease that has not ended yet, the nearest mark it has reached (3, 2 or 1 months), once.
// A lease already over, month-to-month, or let to nobody gets none (the to-do block still shows an overdue one).
export function renewalRemindersDue(properties, todayYmd, monthsBefore = LEASE_REMINDER_DEFAULTS.monthsBefore) {
  const marks = [...new Set((monthsBefore || []).map(Number).filter(n => Number.isFinite(n) && n >= 1))].sort((a, b) => a - b)   // 1, 2, 3
  const out = []
  for (const p of properties || []) {
    if (!isActiveTenancy(p)) continue
    for (const t of leaseTerms(p)) {
      if (t.monthToMonth) continue
      const s = renewalStatus(t.end, todayYmd)
      if (!s || s.over) continue
      const mark = marks.find(n => t.end <= addMonthsYmd(day10(todayYmd), n))
      if (mark) out.push({ propId: p.prop_id, name: p.name || '', location: p.location || '', country: p.country || 'IN', ...t, ...s, mark })
    }
  }
  return out.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0))
}

function money(amount, currency) {
  const n = Number(amount) || 0
  return currency === 'USD' ? `$${n.toLocaleString('en-US')}` : `₹${n.toLocaleString('en-IN')}`
}

// The email for one reminder from renewalRemindersDue(): { subject, emoji, title, lines }. The Worker names the mail in the house style from emoji + title
// (src/utils/emailNaming.js: "Rental360 Reminder — ..."); `subject` is the name it had before 22 Nov 2026 and stays because it is how a reminder already
// sent is recognised. The title names the lease, its end date and the mark, so it is
// the same every time that lease reaches that mark and different for the next term: the Worker uses it to send each reminder once.
export function buildRenewalEmail(item, { time = '', marks = LEASE_REMINDER_DEFAULTS.monthsBefore } = {}) {
  const what = item.unit === 'parking' ? 'parking' : 'lease'
  const theLease = item.unit === 'parking' ? 'The parking lease' : 'The lease'
  // where the end date is changed: the parking lease has its own card on the property's agreement
  const where = item.unit === 'parking'
    ? `Rev360 > Agreements > ${item.name} > Separate Car Parking Tenancy, change its LEASE END and save.`
    : `Rev360 > Agreements > ${item.name}, change the LEASE END and save.`
  const list = [...new Set((marks || []).map(Number).filter(n => Number.isFinite(n) && n >= 1))].sort((a, b) => b - a)
  const markText = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]} months` : `${list[0] || item.mark} ${(list[0] || item.mark) === 1 ? 'month' : 'months'}`
  const title = `Renew in ${plural(item.mark, 'month')}: ${item.name} ${what}${item.who ? ` (${item.who})` : ''} ends ${ymdLabel(item.end)}`
  const subject = `📋 ${title}`
  const lines = [
    'Source: Rev360 > lease renewals',
    `Action: ${theLease} ends within ${plural(item.mark, 'month')}. Talk to the tenant now about renewing it, or plan the move-out.`,
    '',
    `Property:  ${item.name}${item.location ? ` (${item.location})` : ''}`,
    `Lease:     ${item.unit === 'parking' ? 'Parking' : 'Main lease'}`,
    ...(item.who ? [`Tenant:    ${item.who}`] : []),
    `Term:      ${item.start ? ymdLabel(item.start) : 'not set'} to ${ymdLabel(item.end)}`,
    ...(item.fee ? [`Rent:      ${money(item.fee, item.currency)} a month`] : []),
    `Ends in:   ${plural(item.days, 'day')} (${item.label})`,
    '',
    `To record a renewal: ${where}`,
    `This reminder comes ${markText} before a lease ends, once each. The to-do list on the Rev360 home shows what is due.`,
    ...(time ? [`Time: ${time}`] : []),
  ]
  return { subject, emoji: '📋', title, lines }
}
