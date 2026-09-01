/**
 * Draft text for reaching a signup, on either channel.
 *
 * Both drafts are starting points. The screen puts them in a textarea the
 * operator edits before anything is sent - a line that answers what THIS
 * person actually wrote beats any template, and they are looking at those
 * answers while they type.
 *
 * The EMAIL body deliberately is not defined here: it comes from the server
 * (getPlatformSignups -> ackTemplate), so the wording the operator edits is
 * the same wording the automatic acknowledgement uses. Two copies would drift
 * apart the first time either was touched.
 */

// WhatsApp only ever opens in the operator's own client, so this one lives
// here - the server never sends it and has no reason to know it.
export function whatsappDraft(r) {
  const first = String(r.name || '').trim().split(/\s+/)[0] || 'there'
  const channels = String(r.channels || '')
  const many = channels.split(',').filter(Boolean).length >= 4

  // One line that speaks to what they actually told us. Anything more and it
  // reads like a mail merge, which is exactly what a founding-host pitch
  // cannot afford to look like.
  let hook = 'the bookings, the check-ins, Form C, the accounts'
  if (r.foreign_guests && r.foreign_guests !== 'No') {
    hook = many
      ? 'every channel in one calendar, and Form C filed properly for foreign guests'
      : 'the bookings, the check-ins, and Form C filed properly for foreign guests'
  } else if (many) {
    hook = 'every channel reconciled in one calendar, and the accounts'
  }

  const ready = String(r.onboard_3m || '').toLowerCase().startsWith('y')
    ? "You said you're ready to start, so we can move quickly."
    : 'No rush on timing - have a look and decide afterwards.'

  return [
    `Hi ${first} - thanks for putting your name down for StayVibe360.`,
    '',
    `I'm Biji. I run a villa in Guruvayur and built this to manage it - ${hook}.`,
    '',
    `${ready} Next step is a 20-minute call, and I'll send a Zoom link with a`,
    "couple of times in the next few days. Nothing to prepare - I'll show you",
    "the real thing running on our own numbers, and if it isn't a fit I'll say so.",
    '',
    '- Biji',
  ].join('\n')
}

// Digits only, and never assume a country - these leads are mostly Indian but
// the number already carries its own code.
export function waLink(num, text) {
  const digits = String(num || '').replace(/[^0-9]/g, '')
  if (digits.length < 10) return null
  const q = text ? '?text=' + encodeURIComponent(text) : ''
  return 'https://wa.me/' + digits + q
}

export function fillTemplate(template, r) {
  const first = String(r.name || '').trim().split(/\s+/)[0] || 'there'
  return String(template || '').split('{name}').join(first)
}
