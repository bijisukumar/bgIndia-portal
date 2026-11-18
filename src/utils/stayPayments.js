// Payments received against a booking ("Payments" on Complete booking): the day each one came in, in parts if the host works that way.
// Pure (no clock, no database), so the Worker, the screen and the tests read a booking's payments the same way.
//
// A payment, as the Worker serves it: { paymentId, amount, paidDate: 'YYYY-MM-DD', mode, note, recordedBy, recordedAt }.
// The booking's TOTAL is what the guest owes the host directly: the booking's gross (the room and the extras). A booking a platform
// collects (Airbnb ...) never comes here: the platform pays the host, and that is not a payment from the guest.
//
// A host switches it on with a `payments` block in hosts/<id>/config.js:
//   payments: { split: false, modes: ['UPI', 'Bank transfer', 'Cash'] }
// No block, no Payments. `split` false (the standard): one tap, "Mark as paid", records the whole balance on a day. `split` true: any
// amount can be entered, as many times as the guest pays. `modes` is the list offered for how it was paid.
import { isYmd } from './seasonRates.js'

export const DEFAULT_PAYMENT_MODES = ['UPI', 'Bank transfer', 'Cash', 'Card', 'Other']
export const MAX_PAYMENT = 100000000   // ten crore: an amount above this is a slip of the finger
export const round2 = n => Math.round((Number(n) || 0) * 100) / 100

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v)

// The host's settings: { enabled, split, modes }. A host with no `payments` block (or `enabled: false`) has the feature off.
export function paymentSettings(config) {
  const p = config && config.payments
  const off = { enabled: false, split: false, modes: DEFAULT_PAYMENT_MODES.slice() }
  if (!isObj(p) || p.enabled === false) return off
  const modes = Array.isArray(p.modes) ? p.modes.map(m => String(m == null ? '' : m).trim().slice(0, 30)).filter(Boolean).slice(0, 12) : []
  return { enabled: true, split: p.split === true, modes: modes.length ? modes : DEFAULT_PAYMENT_MODES.slice() }
}

// The host's own spelling of a mode ('upi' -> 'UPI'); '' when none was given; null for one that is not on its list.
export function pickMode(modes, value) {
  const v = String(value == null ? '' : value).trim().toLowerCase()
  if (!v) return ''
  return (modes || []).find(m => String(m).toLowerCase() === v) || null
}

// A reference or remark: control and invisible direction characters become spaces, runs of spaces collapse, at most `max` characters.
export function cleanNote(value, max = 200) {
  let out = ''
  for (const ch of String(value == null ? '' : value)) {
    const c = ch.codePointAt(0)
    const bad = c < 32 || c === 127 || (c >= 0x200b && c <= 0x200f) || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)
    out += bad ? ' ' : ch
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max)
}

// What has come in against a booking's total. rows: the payments NOT removed, in any order.
//   status: 'unpaid' (nothing in), 'received' (money in but no price set to compare with), 'part', 'paid' (the total is covered).
//   paidInFullOn: the day of the payment that covered the total, in date order; null until it is covered.
//   over: how much more than the total has come in (0 when not over).
export function paymentSummary(total, rows) {
  const t = Math.max(0, round2(total))
  const list = (rows || []).filter(r => r && Number(r.amount) > 0).slice()
    .sort((a, b) => String(a.paidDate || '').localeCompare(String(b.paidDate || '')) || String(a.recordedAt || '').localeCompare(String(b.recordedAt || '')))
  const paid = round2(list.reduce((s, r) => s + Number(r.amount), 0))
  const covered = t > 0 && paid >= t
  let paidInFullOn = null
  if (covered) {
    let run = 0
    for (const r of list) { run = round2(run + Number(r.amount)); if (run >= t) { paidInFullOn = r.paidDate || null; break } }
  }
  return {
    total: t, paid,
    balance: t > 0 ? Math.max(0, round2(t - paid)) : 0,
    over: t > 0 && paid > t ? round2(paid - t) : 0,
    paidInFullOn,
    lastPaidOn: list.length ? (list[list.length - 1].paidDate || null) : null,
    count: list.length,
    status: paid <= 0 ? 'unpaid' : (t <= 0 ? 'received' : (covered ? 'paid' : 'part')),
  }
}

// A day the money can have come in: a real calendar date, not after `today` ('YYYY-MM-DD', the property's day).
export function validPaidDate(value, today) {
  const d = String(value == null ? '' : value).slice(0, 10)
  return isYmd(d) && (!today || d <= today) ? d : null
}
