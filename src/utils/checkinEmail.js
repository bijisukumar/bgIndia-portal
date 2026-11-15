// ============================================================
//  THE CHECK-IN EMAIL
//
//  The owner's "✉️ Send email" on Complete booking: ONE email to the guest with the online check-in link at the very top (a button in
//  the HTML version, the bare link above the greeting in the plain-text one) and the booking details under it. It is the email twin of
//  the two WhatsApp buttons beside it (the intro and the check-in link), for a guest who has an email address and reads email.
//
//  Pure (utils/guestWording.js and utils/stayTimes.js only): the Worker (action sendCheckinEmail) reads the stay and sends through
//  Resend from the host's guest address, with a silent copy to the villa inbox, exactly as the checkout-day email goes; this file words
//  it. Every word that is the host's own is in hosts/<id>/config.js, guestMessages.checkinEmail:
//    subject, subjectDone  the subject, for a guest who still has to check in and for one who already has (subjectDone is optional)
//    linkIntro             the sentence above the button (and above the bare link)
//    linkButton            what the button says
//    doneIntro             said instead of all that once the guest has done the online check-in form
//    bedType               said beside the bedroom count: "3 (Indian Queen Size beds)"; optional
//    template              the rest of the email: {firstName} {villaName} {checkinDateShort} {checkinDateFull} {checkoutDateFull}
//                          {nights} {guestCount} {ownerName} {ownerWhatsApp} {managerName} {managerPhone} {brandName} {checkinUrl}
//                          and {bookingDetails}: the Check-in / Check-out / Guests / Bedrooms / Duration / Address / Map lines, which
//                          the code builds (an agreed early check-in or late check-out is stated; a declined one never is)
//  A host without this block cannot send the email: the button answers that it is not set up.
// ============================================================
import { greetingName, bedroomsNeeded, longDate, shortDate } from './guestWording.js'
import { stayTimes } from './stayTimes.js'

export const CHECKIN_EMAIL_KIND = 'checkin_link'

// Once the guest is in the villa, has left, or the booking is dead, a check-in email is pointless (and confusing).
const OVER = new Set(['checked_in', 'ready_for_checkout', 'checked_out', 'closed', 'cancelled', 'void', 'no_show'])
export function canSendCheckinEmail(stay) {
  return !OVER.has(String((stay && stay.status) || '').trim().toLowerCase())
}

// stays.source -> the guest's check-in link: the same rule as the WhatsApp check-in link (utils/guestMessages.js): the host's public
// address + /checkin/ + the token of the booking's channel, or the host's default token for a channel with none of its own. '' when
// the host has no address or no token for it.
export function checkinUrlFor(stay, host) {
  const base = String((host && host.checkinBaseUrl) || '').replace(/\/+$/, '')
  if (!base) return ''
  const src = String((stay && stay.source) || '').trim().toLowerCase()
  const token = ((host && host.checkinLinkTokens) || {})[src] || (host && host.checkinLinkDefaultToken)
  return token ? `${base}/checkin/${token}` : ''
}

// The newest "check-in email sent" line on a stay row (the Worker puts `guestEmails` on the lists), or null.
export function lastCheckinEmail(stay) {
  const list = stay && Array.isArray(stay.guestEmails) ? stay.guestEmails : []
  let last = null
  for (const e of list) if (e && e.kind === CHECKIN_EMAIL_KIND) last = e
  return last
}

// ---- the words ----
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
// Escaped text -> a bare http(s) address made clickable (trailing punctuation is not part of the address).
const linkify = escaped => escaped.replace(/(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, '<a href="$1" style="color:#1d4ed8">$1</a>')
const render = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
// Lines with trailing blanks and runs of blank lines tidied: an unset name or number must not leave a gap.
const tidy = s => String(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

// [label, value, 'link'?] for each line of the booking. A part the stay does not have (no dates, no party) is left out, never shown as a dash.
function detailRows(stay, host, villa, cfg) {
  const t = stayTimes(stay, { checkin: villa.checkinTime || '4:00 PM', checkout: villa.checkoutTime || '11:00 AM' })
  const ci = longDate(stay.checkin_date), co = longDate(stay.checkout_date)
  const adults = parseInt(stay.adults, 10) || 0
  const children = parseInt(stay.children, 10) || 0
  const total = adults + children
  const breakdown = children > 0 ? ` (${adults} adult${adults === 1 ? '' : 's'} + ${children} child${children === 1 ? '' : 'ren'})` : ''
  let nights = parseInt(stay.nights, 10) || 0
  if (!nights && ci && co) {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(stay.checkin_date), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(stay.checkout_date)
    nights = Math.max(1, Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86400000))
  }
  const hostIntro = (host.guestMessages && host.guestMessages.hostIntro) || {}
  const bedType = cfg.bedType != null ? cfg.bedType : (hostIntro.bedType || '')
  const rooms = villa.bedrooms ? bedroomsNeeded(villa.bedrooms, total) : 0
  const rows = []
  if (ci) rows.push(['Check-in', `${ci}, from ${t.inTime}${t.inEarly ? ' (early check-in, as agreed)' : ''}`])
  if (co) rows.push(['Check-out', `${co}, by ${t.outTime}${t.outLate ? ' (late check-out, as agreed)' : ''}`])
  if (total > 0) rows.push(['Guests', `${total} total${breakdown}`])
  if (rooms) rows.push(['Bedrooms', bedType ? `${rooms} (${bedType})` : String(rooms)])
  if (nights) rows.push(['Duration', `${nights} night${nights === 1 ? '' : 's'}`])
  if (villa.address) rows.push(['Address', villa.address])
  if (villa.mapsLink) rows.push(['Map', villa.mapsLink, 'link'])
  return rows
}

const MARK = '\u0001DETAILS\u0001'   // where {bookingDetails} goes in the HTML: the table is put there after the text is escaped

function detailsTable(rows) {
  if (!rows.length) return ''
  const cell = 'padding:8px 0;border-bottom:1px solid #e5e7eb'
  const tr = ([k, v, kind]) =>
    `<tr><td style="${cell};font-size:13px;color:#6b7280;width:104px;vertical-align:top">${esc(k)}</td>` +
    `<td style="${cell};padding-left:10px;font-size:15px;line-height:1.5;color:#111827">${kind === 'link' ? `<a href="${esc(v)}" style="color:#1d4ed8">${esc(v)}</a>` : esc(v)}</td></tr>`
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 18px;border-top:1px solid #e5e7eb">${rows.map(tr).join('')}</table>`
}

// The template's text -> HTML: paragraphs at blank lines, line breaks inside them, addresses clickable, an all-capitals line alone
// ("YOUR BOOKING DETAILS") as a small heading, and the booking-details table where {bookingDetails} stood.
function bodyHtml(text, rows) {
  const out = []
  let buf = []
  const flush = () => {
    if (!buf.length) return
    if (buf.length === 1 && /^[A-Z][A-Z0-9 &'.,:\-]{3,40}$/.test(buf[0].trim())) {
      out.push(`<div style="margin:6px 0;font-size:12px;letter-spacing:.1em;color:#9a7b1f;font-weight:700">${esc(buf[0].trim())}</div>`)
    } else {
      out.push(`<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${buf.map(l => linkify(esc(l))).join('<br>')}</p>`)
    }
    buf = []
  }
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === MARK) { flush(); out.push(detailsTable(rows)); continue }
    if (!line.trim()) { flush(); continue }
    buf.push(line)
  }
  flush()
  return out.join('')
}

// stay: a stayvibe_stays row; host: the host's config (getHostConfig); registered: whether the guest has done the online check-in form
// (the Worker works it out the way the lists do, through a form twin; left out, the stay's own flag is used).
// -> { subject, text, html, link, done }  or  { error } when the host has no such email or no link to put in it.
export function buildCheckinEmail({ stay = {}, host = {}, registered } = {}) {
  const cfg = host && host.guestMessages && host.guestMessages.checkinEmail
  if (!cfg || !cfg.template || !cfg.subject) return { error: 'The check-in email is not set up for this property yet.' }
  const villa = (host.villas && host.villas[0]) || {}
  const done = registered != null ? !!registered : !!stay.checkin_form_submitted
  const url = checkinUrlFor(stay, host)
  if (!done && !url) return { error: 'There is no check-in link set up for this booking source.' }

  const rows = detailRows(stay, host, villa, cfg)
  const guests = (rows.find(r => r[0] === 'Guests') || [])[1] || ''
  const nightsRow = (rows.find(r => r[0] === 'Duration') || [])[1] || ''
  const vars = {
    firstName: greetingName(stay.guest_name),
    villaName: villa.arrivalFullName || villa.full || villa.name || host.brandName || '',
    checkinDateShort: shortDate(stay.checkin_date),
    checkinDateFull: longDate(stay.checkin_date),
    checkoutDateFull: longDate(stay.checkout_date),
    nights: nightsRow.replace(/ nights?$/, ''),
    guestCount: guests,
    ownerName: host.ownerName || '',
    ownerWhatsApp: host.ownerWhatsApp || '',
    managerName: villa.managerName || '',
    managerPhone: villa.managerPhone || '',
    brandName: host.brandName || '',
    checkinUrl: url,
  }
  const subject = tidy(render(done && cfg.subjectDone ? cfg.subjectDone : cfg.subject, vars)).replace(/\s*\n\s*/g, ' ')
  const button = cfg.linkButton || 'Complete online check-in'

  // plain text: the link first, then the email
  const topText = done ? String(cfg.doneIntro || '') : [cfg.linkIntro, `${button}: ${url}`].filter(Boolean).join('\n')
  const text = tidy(`${topText}\n\n${render(cfg.template, { ...vars, bookingDetails: rows.map(([k, v]) => `${k}: ${v}`).join('\n') })}`)

  // HTML: the same, with the link as a button
  const topHtml = done
    ? (cfg.doneIntro
        ? `<div style="margin:0 0 22px;padding:14px 18px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;font-size:15px;line-height:1.6;color:#14532d">&#10003; ${esc(cfg.doneIntro)}</div>`
        : '')
    : `<div style="margin:0 0 22px;padding:16px 18px;border:1px solid #e5e7eb;border-radius:12px;background:#fafaf7">` +
      (cfg.linkIntro ? `<div style="font-size:15px;line-height:1.6;color:#374151;margin-bottom:14px">${esc(cfg.linkIntro)}</div>` : '') +
      `<a href="${esc(url)}" style="display:inline-block;background:#C9A84C;color:#111827;text-decoration:none;font-weight:700;font-size:16px;padding:14px 26px;border-radius:999px">${esc(button)} &rarr;</a>` +
      `<div style="font-size:12px;color:#6b7280;line-height:1.5;margin-top:12px;word-break:break-all">If the button does not work, copy this link into your browser:<br><a href="${esc(url)}" style="color:#6b7280">${esc(url)}</a></div>` +
      `</div>`
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px;color:#111827">` +
    topHtml + bodyHtml(tidy(render(cfg.template, { ...vars, bookingDetails: MARK })), rows) + `</div>`

  return { subject, text, html, link: url, done }
}

// The same email as a TEST COPY for the owner to read before the guest gets the real one: "[TEST] " in front of the subject and a plain
// note at the very top (a yellow strip in the HTML) saying it is a test and went to nobody else. Nothing else changes, so what the owner
// reads is what the guest will get. `guestName` is how the guest is greeted ("Prahlad").
export function asTestCopy(mail, { guestName = '' } = {}) {
  const who = String(guestName || '').trim() || 'the guest'
  const note = `TEST COPY: this is the email ${who} would get. Nothing has been sent to ${who}.`
  const strip = `<div style="margin:0 0 16px;padding:10px 14px;border-radius:8px;background:#fff7d6;border:1px solid #f0d36b;font-size:13px;line-height:1.5;color:#6b5200"><b>TEST COPY</b>: this is the email ${esc(who)} would get. Nothing has been sent to ${esc(who)}.</div>`
  return {
    ...mail,
    subject: `[TEST] ${mail.subject}`,
    text: `${note}\n\n${mail.text}`,
    html: String(mail.html).replace(/^(<div[^>]*>)/, `$1${strip}`),
  }
}
