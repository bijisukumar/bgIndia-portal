// ============================================================
//  checkoutInvoice.js: the rules and the words of the CHECK-OUT PAYMENT and its INVOICE.
//
//  At check-out the caretaker tallies the guest's incidentals, the guest scans a UPI QR code and pays (adding a tip for the team if they
//  like), the caretaker confirms how it was paid, and the guest is sent an invoice on WhatsApp or by email. This file is the pure part,
//  shared by the screen (the UPI link behind the QR) and the Worker (checking and recording the payment, wording the invoice):
//
//    upiLink            the upi://pay link the QR code carries (amount filled in)
//    validateCheckoutPayment   what the Worker accepts from the screen
//    buildCheckoutInvoice      the WhatsApp text, the plain-text email and the HTML email, from the host's own wording
//
//  The wording is the host's: hosts/<id>/config.js, guestMessages.invoice:
//    subject     the email subject
//    template    the message: {firstName} {guestName} {villaName} {brandName} {ownerName} {ownerWhatsApp} {checkinDateShort}
//                {checkoutDateShort} {nights} {reference} {total} and the two blocks the code builds: {invoiceDetails} (guest, stay,
//                check-out charges, tip, total paid, reference) and {marketingLines} (the host's Kerala experiences page, villa page,
//                direct-booking phone and site, and review link, all from the host's `marketing` and `guestMessages.reviewRequest`)
//    labels      optional: the left-hand words of the details lines
//    marketing   optional: the words in front of the villa, direct-booking and review lines
//  This is NOT a GST tax invoice (no GSTIN, no tax split, no running invoice number): the template says so in its own words.
//  A host without the block cannot send the invoice: the screen answers that it is not set up.
// ============================================================
import { greetingName, shortDate } from './guestWording.js'
import { cleanNote } from './stayPayments.js'

export const CHECKOUT_PAYMENT_EVENT = 'checkout_payment'   // infra_processing_log.event_type of each recorded payment
export const CHECKOUT_INVOICE_KIND = 'checkout_invoice'    // kind on the guest_email line of an invoice email
export const PAY_MODES = ['UPI', 'Cash', 'Card']
export const TIP_PRESETS = [100, 200, 500]
export const MAX_TIP = 50000
export const MAX_CHARGE = 500000

const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// 1234567.5 -> "₹12,34,567.50" (Indian grouping), whole rupees without the paise.
export function inr(n) {
  const v = round2(Number(n) || 0)
  const [whole, frac] = Math.abs(v).toFixed(2).split('.')
  const grouped = whole.length > 3 ? whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + whole.slice(-3) : whole
  return (v < 0 ? '-' : '') + '₹' + grouped + (frac === '00' ? '' : '.' + frac)
}

// ---- the QR code's link ----
// UPI deep link: pa = who is paid, pn = their name, am = the amount, cu = INR, tn = the note on the payment. '' when the id or the amount
// is not usable (no QR is drawn then). The "@" stays as it is: every UPI app reads it that way.
const encodePart = s => encodeURIComponent(s).replace(/%40/g, '@').replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
export function upiLink({ vpa, name, amount, note } = {}) {
  const pa = String(vpa || '').trim()
  if (!/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,30}$/.test(pa)) return ''
  const am = round2(amount)
  if (!(am > 0) || am > MAX_CHARGE + MAX_TIP) return ''
  const parts = ['pa=' + encodePart(pa)]
  const pn = cleanNote(name).slice(0, 40).trim()
  if (pn) parts.push('pn=' + encodePart(pn))
  parts.push('am=' + am.toFixed(2), 'cu=INR')
  const tn = cleanNote(note).slice(0, 40).trim()
  if (tn) parts.push('tn=' + encodePart(tn))
  return 'upi://pay?' + parts.join('&')
}

// A guest's phone as wa.me wants it: digits only, with India's 91 in front of a bare 10-digit number. '' when there is none.
export function waNumber(phone) {
  const raw = String(phone || '').replace(/\D/g, '')
  if (!raw) return ''
  return raw.startsWith('91') ? raw : (raw.length === 10 ? '91' + raw : raw)
}

// ---- what the Worker accepts ----
// body: { mode, items: [{ name, qty, pricePerUnit, subtotal? }], amount?, tip? }. The amount is worked out from the items (never trusted
// from the screen); a screen amount that disagrees is refused. -> { value: { mode, items, amount, tip, total } } or { error }.
export function validateCheckoutPayment(body = {}) {
  const mode = PAY_MODES.concat(['Other']).find(m => m.toLowerCase() === String(body.mode || '').trim().toLowerCase())
  if (!mode) return { error: 'Choose how it was paid: UPI, cash or card.' }
  const list = Array.isArray(body.items) ? body.items : []
  if (!list.length || list.length > 60) return { error: 'There are no items to invoice.' }
  const items = []
  for (const it of list) {
    const name = cleanNote(it && it.name).slice(0, 80).trim()
    const qty = Number(it && it.qty)
    const price = round2(it && (it.pricePerUnit != null ? it.pricePerUnit : it.price))
    if (!name || !Number.isInteger(qty) || qty < 1 || qty > 999 || !(price >= 0) || price > 100000) return { error: 'One of the items is not valid.' }
    items.push({ name, qty, price, subtotal: round2(qty * price) })
  }
  const amount = round2(items.reduce((s, i) => s + i.subtotal, 0))
  if (!(amount > 0) || amount > MAX_CHARGE) return { error: 'The total is not valid.' }
  if (body.amount != null && Math.abs(round2(body.amount) - amount) > 0.01) return { error: 'The total does not match the items.' }
  const tipNum = body.tip == null || body.tip === '' ? 0 : Number(body.tip)
  if (!Number.isFinite(tipNum) || tipNum < 0 || tipNum > MAX_TIP || Math.round(tipNum) !== tipNum) return { error: 'The tip must be a whole number of rupees, up to ' + MAX_TIP + '.' }
  return { value: { mode, items, amount, tip: tipNum, total: round2(amount + tipNum) } }
}

// The recorded payments of a stay, from its infra_processing_log rows (oldest first): [{ ref, mode, amount, tip, total, paidOn, items, by, at }].
export function checkoutPaymentEvents(rows) {
  const out = []
  for (const r of rows || []) {
    try {
      const e = JSON.parse(r.note)
      if (e && typeof e === 'object' && e.ref) out.push({ ...e, at: r.created_at })
    } catch { /* a line that is not ours */ }
  }
  return out
}

// ---- the words ----
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const linkify = escaped => escaped.replace(/(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, '<a href="$1" style="color:#1d4ed8">$1</a>')
const render = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
const tidy = s => String(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
const DETAILS_MARK = '@@DETAILS@@'
const MARKETING_MARK = '@@MARKETING@@'

const dmy = ymd => (/^\d{4}-\d{2}-\d{2}/.test(String(ymd || '')) ? `${shortDate(ymd)} ${String(ymd).slice(0, 4)}` : '')

function nightsOf(stay) {
  const n = parseInt(stay.nights, 10)
  if (n > 0) return n
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(stay.checkin_date || ''), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(stay.checkout_date || '')
  return a && b ? Math.max(1, Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86400000)) : 0
}

// stay: a stayvibe_stays row; host: the host's config (the Worker's getHostConfig); payment: { ref, mode, amount, tip, total, paidOn }.
// -> { subject, whatsapp, text, html } or { error }.
export function buildCheckoutInvoice({ stay = {}, host = {}, payment = {} } = {}) {
  const cfg = host && host.guestMessages && host.guestMessages.invoice
  if (!cfg || !cfg.template || !cfg.subject) return { error: 'The invoice is not set up for this property yet.' }
  const villa = (host.villas && host.villas[0]) || {}
  const m = host.marketing || {}
  const L = Object.assign({ guest: 'Guest', stay: 'Stay', charges: 'Check-out charges', tip: 'Tip for our team', total: 'Total paid', reference: 'Reference' }, cfg.labels || {})
  const M = Object.assign({ villa: 'See the villa', direct: 'Book direct next time', review: 'A 5-star review means a lot' }, cfg.marketing || {})
  const nights = nightsOf(stay)
  const co = stay.checkout_date
  const stayText = `${shortDate(stay.checkin_date)} to ${shortDate(co)} ${String(co || '').slice(0, 4)}`.trim() + (nights ? ` (${nights} night${nights === 1 ? '' : 's'})` : '')

  const rows = []
  if (stay.guest_name) rows.push([L.guest, stay.guest_name])
  if (stay.checkin_date && co) rows.push([L.stay, stayText])
  rows.push([L.charges, inr(payment.amount)])
  if (payment.tip > 0) rows.push([L.tip, inr(payment.tip)])
  rows.push([L.total, `${inr(payment.total)}, ${payment.mode}${payment.paidOn ? ', ' + dmy(payment.paidOn) : ''}`])
  if (payment.ref) rows.push([L.reference, payment.ref])

  const links = []   // [label, value, isLink]
  if (m.experiencesUrl) links.push([m.experiencesLabel || 'Explore Kerala experiences', m.experiencesUrl, true])
  if (m.villaDetailsUrl) links.push([M.villa, m.villaDetailsUrl, true])
  const direct = [m.flyerPhone || host.ownerWhatsApp, m.flyerWebsite].filter(Boolean).join(' / ')
  if (direct) links.push([M.direct, direct, false])
  const reviewUrl = host.guestMessages && host.guestMessages.reviewRequest && host.guestMessages.reviewRequest.links && host.guestMessages.reviewRequest.links.default && host.guestMessages.reviewRequest.links.default.url
  if (reviewUrl) links.push([M.review, reviewUrl, true])

  const vars = {
    firstName: greetingName(stay.guest_name),
    guestName: stay.guest_name || '',
    villaName: villa.arrivalFullName || villa.full || villa.name || host.brandName || '',
    brandName: host.brandName || '',
    ownerName: host.ownerName || '',
    ownerWhatsApp: host.ownerWhatsApp || '',
    checkinDateShort: shortDate(stay.checkin_date),
    checkoutDateShort: shortDate(co),
    nights: nights ? String(nights) : '',
    reference: payment.ref || '',
    total: inr(payment.total),
  }
  const lines = list => list.map(([k, v]) => `${k}: ${v}`).join('\n')
  const subject = tidy(render(cfg.subject, vars)).replace(/\s*\n\s*/g, ' ')
  const whatsapp = tidy(render(cfg.template, { ...vars, invoiceDetails: lines(rows), marketingLines: lines(links) }))
  const text = whatsapp.replace(/^\*(.+)\*$/gm, '$1')

  // HTML: paragraphs at blank lines, a heading for a line that is only *CAPITALS*, the details as a table and the links as a list
  const cell = 'padding:8px 0;border-bottom:1px solid #e5e7eb'
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 18px;border-top:1px solid #e5e7eb">` +
    rows.map(([k, v], i) => `<tr><td style="${cell};font-size:13px;color:#6b7280;width:132px;vertical-align:top">${esc(k)}</td><td style="${cell};padding-left:10px;font-size:15px;line-height:1.5;color:#111827${i === rows.length - 1 || /^Total/.test(k) ? ';font-weight:700' : ''}">${esc(v)}</td></tr>`).join('') + `</table>`
  const list = links.length
    ? `<ul style="margin:0 0 18px;padding:0 0 0 18px;font-size:15px;line-height:1.8">` +
      links.map(([k, v, isLink]) => `<li>${esc(k)}: ${isLink ? `<a href="${esc(v)}" style="color:#1d4ed8">${esc(v)}</a>` : esc(v)}</li>`).join('') + `</ul>`
    : ''
  const body = tidy(render(cfg.template, { ...vars, invoiceDetails: DETAILS_MARK, marketingLines: MARKETING_MARK }))
  const out = []
  let buf = []
  const flush = () => {
    if (!buf.length) return
    const one = buf.length === 1 ? buf[0].trim().replace(/^\*(.+)\*$/, '$1') : ''
    if (one && /^[A-Z][A-Z0-9 &'.,:\-]{3,40}$/.test(one)) {
      out.push(`<div style="margin:6px 0;font-size:12px;letter-spacing:.1em;color:#9a7b1f;font-weight:700">${esc(one)}</div>`)
    } else {
      out.push(`<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${buf.map(l => linkify(esc(l))).join('<br>')}</p>`)
    }
    buf = []
  }
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === DETAILS_MARK) { flush(); out.push(table); continue }
    if (line.trim() === MARKETING_MARK) { flush(); out.push(list); continue }
    if (!line.trim()) { flush(); continue }
    buf.push(line)
  }
  flush()
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px;color:#111827">${out.join('')}</div>`
  return { subject, whatsapp, text, html }
}
