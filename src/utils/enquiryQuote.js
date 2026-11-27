// ============================================================
//  THE WHATSAPP QUOTE: THE TEXT WE SEND A GUEST (src/utils/enquiryQuote.js)
//
//  What it is: the one place that writes the quote message (Biji's "Generate & copy" text and the "Send quote in WhatsApp" link). Pure functions,
//  no screen code: give it an enquiry-shaped object and it returns the words.
//    buildQuote(e, rich)    the message. rich = true for pasting by hand (full emoji); rich = false for the wa.me link (WhatsApp Desktop on Windows
//                           turns 4-byte emoji into a "�" on that path, so the plain version keeps to what survives).
//    buildQuoteWaLink(e)    the https://wa.me/<phone>?text=... link with the plain version.
//  Three versions of the message, picked by buildQuote: first contact (the default), a returning / loyal guest (leads with the discount) and a
//  travel partner (shows the commission). Used by: the Enquiry screen (src/screens/villa/EnquiryDetail.jsx) and the Complete booking "Go direct?"
//  card (src/components/GoDirectCard.jsx), so both send the same quote.
//
//  WHAT CHANGED (newest first)
//    2026-11-27  (later) For the "Go direct?" card's own prices (the same price as the platform, or a figure typed by hand): when e._totalOnly is set
//                the room line reads "₹41,960 for 3 nights" instead of "₹13,987/night × 3 nights = ₹41,960", because a total that does not divide
//                evenly by the nights would show arithmetic that is a rupee out. Enquiries never set it, so their quotes are unchanged.
//    2026-11-27  For the "Go direct?" card: (1) when e._partnerLabel is set (the platform the guest already booked through) the opening and closing
//                lines fit a guest who already holds a booking instead of a first enquiry; (2) a fourth version, the DIRECT OFFER (e.discount_category
//                === 'direct_offer'), with a discount line. Enquiries never set either, so their quotes are unchanged.
//    2026-11-27  Moved here, word for word, out of EnquiryDetail.jsx so a second screen can send the same quote (checked old against new on every
//                version, both modes, with and without seasons, discounts and early/late lines).
//    2026-11-23  The quote says the early check-in / late check-out hour the guest asked for (utils/quoteTimes.js).
//    2026-10-28  Busy-season prices night by night, with the regular price beside a season's (utils/seasonRates.js).
//    2026-10-05  The villa-pictures link leads the message (WhatsApp builds its link preview from the FIRST link); no "❓" through wa.me.
//  Older history of these functions is in git: git log --follow src/utils/enquiryQuote.js, then src/screens/villa/EnquiryDetail.jsx.
// ============================================================
import { CONFIG } from '../config'
import { parseLocalDate } from './dates'
import { DEFAULT_VILLA_ID } from './villaContext'
import { DISCOUNT_CATEGORIES, getBedroomEstimate } from './villaPricing'
import { quoteTimes, labelWithTimes, dateNotes } from './quoteTimes.js'

// The villa this host sells (its standard check-in and check-out times are quoted from here).
const villa = CONFIG.villas[0]

// ₹ with Indian digit grouping: 16307 -> "₹16,307".
function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

// Builds a wa.me deep-link pre-filled with the quote text, so the owner can
// open the guest's WhatsApp chat with it ready to send (not auto-sent).
// Uses the emoji-safe version — WhatsApp Desktop/Windows renders 4-byte
// (astral-plane) emoji as '�' when text arrives via this URI path.
export function buildQuoteWaLink(e) {
  const phone = e.phone
  if (!phone) return null
  const raw = String(phone).replace(/\D/g, '')
  const num = raw.startsWith('91') ? raw : (raw.length === 10 ? `91${raw}` : raw)
  return `https://wa.me/${num}?text=${encodeURIComponent(buildQuote(e, false))}`
}

function fmtQuoteDate(d) {
  const parsed = parseLocalDate(d)
  if (!parsed) return '—'
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Shared pieces every quote variant needs, computed once.
// roomOnlyTotal/perNight deliberately exclude extraLines — those are
// one-time add-ons (event services, cleaning fee, extra guest, etc.), not
// a nightly recurring cost, so folding them in inflates the per-night rate
// shown to the guest.
function quoteCore(e) {
  const nights = e.nights || 1
  const billableGuests = (e.adults || 0) + (e.children || 0)
  let extraLines = []
  try { extraLines = e.extra_lines ? JSON.parse(e.extra_lines) : [] } catch { extraLines = [] }
  // The early check-in / late check-out the guest asked for, read from ALL the lines: a complimentary one has no fee line but is still a time.
  const times = quoteTimes(extraLines)
  // Only the lines that cost something are printed, each with the hour it was asked for ("Early Check-in (from 12:00 PM)").
  extraLines = extraLines.filter(l => (parseFloat(l.amount) || 0) > 0).map(l => ({ ...l, label: labelWithTimes(l) }))
  const extraTotal = extraLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const roomOnlyTotal = (e.quote_amount || 0) - (e.discount_amount || 0)
  return {
    nights,
    finalTotal: e.final_offer_amount || e.quote_amount || 0,
    quoteAmount: e.quote_amount || 0,
    discountAmount: e.discount_amount || 0,
    roomOnlyTotal,
    perNight: Math.round(roomOnlyTotal / nights),
    extraLines,
    extraTotal,
    dateNotes: dateNotes(times, villa),   // the brackets of the Check-in / Check-out lines: the standard time, or the early / late one asked for
    bedroomCount: getBedroomEstimate(e.villa_id || DEFAULT_VILLA_ID, billableGuests),
    firstName: (e.guest_name || '').trim().split(' ')[0] || 'there',
    fullName: (e.guest_name || '').trim() || 'there',
    guestCount: e.guests_count || billableGuests || 1,
    seasonGroups: e._seasonGroups || null,   // the nights in runs of the same season and price, when the quote is the seasonal estimate
    nightsLabel: nights === 1 ? 'the night' : `${nights} nights`,
    // Set only by the Complete booking "Go direct?" card: the platform this guest already booked through ("Airbnb"). It changes the opening and
    // closing lines of the quote (this is not a first enquiry), nothing about the prices.
    partnerLabel: e._partnerLabel || '',
    // Set only by the same card, when the room price is the platform's price or a typed figure that does not divide evenly by the nights: the room
    // line then shows the total for the stay instead of a per-night rate times the nights.
    totalOnly: !!e._totalOnly,
  }
}

// "• ₹14,025/night × 2 nights" then "• Christmas / New Year: ₹18,233/night × 2 nights (regular ₹14,025)"
function seasonRateLines(groups) {
  return groups.map(g => `• ${g.name || 'Regular'}: ${fmt(g.rate)}/night × ${g.nights} night${g.nights !== 1 ? 's' : ''}${g.name && g.rate !== g.regular ? ` (regular ${fmt(g.regular)})` : ''}`)
}
// the same nights as a block of their own, for the discount variants (which then show the discount on the total)
function seasonLines(c, ic) {
  return c.seasonGroups ? [`${ic.money}Pricing night by night:`, ...seasonRateLines(c.seasonGroups), ``] : []
}

// Pricing block lines shared by all 3 quote variants — per-night rate ×
// nights = subtotal, one-time extras itemized separately, total last (so
// the guest sees the per-night rate first, not one big lump number).
// iconPrefix already includes the trailing space (e.g. ic.money, ic.sparkle).
function pricingLines(c, iconPrefix, rateLabel) {
  // A stay that runs into a season (a busy one, or an off-season offer) is shown night by night with the regular price beside the
  // season's. With a discount on top the nights are shown higher up (seasonLines) and this keeps its one summary line.
  const lines = c.seasonGroups && !c.discountAmount
    ? [`${iconPrefix}${rateLabel}:`, ...seasonRateLines(c.seasonGroups), `Room total: ${fmt(c.roomOnlyTotal)}`]
    : [c.totalOnly
        ? `${iconPrefix}${rateLabel}: ${fmt(c.roomOnlyTotal)} for ${c.nights} night${c.nights !== 1 ? 's' : ''}`
        : `${iconPrefix}${rateLabel}: ${fmt(c.perNight)}/night × ${c.nights} night${c.nights !== 1 ? 's' : ''} = ${fmt(c.roomOnlyTotal)}`]
  for (const l of c.extraLines) {
    lines.push(`+ ${l.label}: ${fmt(l.amount)}`)
  }
  if (c.extraLines.length > 0) {
    lines.push(`Total: ${fmt(c.finalTotal)} (all inclusive)`)
  }
  return lines
}

// rich=true (Generate & copy): full colorful emoji — safe for copy/paste,
// which doesn't go through the URI-decode path that corrupts them on
// WhatsApp Desktop/Windows. rich=false (Send quote in WhatsApp button):
// only ☎. ❓ was in the "safe" set, but a sent quote showed it as "�" in front of
// "FAQs:" (2026-10-05), and ✅ did the same on the arrival message (2026-10-15), so all
// three pictographs (❓ ✅ ✨) are rich-only now — if a "�" ever shows next to ☎, drop
// that one the same way.
function icons(rich) {
  return {
    pray:      rich ? '🙏 ' : '',
    calendar:  rich ? '📅 ' : '',
    link:      rich ? '🔗 ' : '',
    villa:     rich ? '🏡 ' : '',
    guests:    rich ? '👨‍👩‍👧‍👦 ' : '',
    money:     rich ? '💰 ' : '',
    leaf:      rich ? '🌿 ' : '',
    camera:    rich ? '📸 ' : '',
    gift:      rich ? '🎁 ' : '',
    handshake: rich ? '🤝 ' : '',
    phone:     rich ? '📞 ' : '☎ ',
    // Rich-only like the rest: ✅ was seen arriving as "�" through wa.me on 2026-10-15 (on the
    // arrival message), so the "safe BMP symbols" assumption below did not hold for it, and ✨
    // is the same kind of character.
    sparkle:   rich ? '✨ ' : '',
    check:     rich ? '✅ ' : '',
    question:  rich ? '❓ ' : '',
  }
}

function familiesBlock(ic) {
  return [
    `${ic.leaf}Why families choose us in Guruvayur`,
    `Luxury Villas of Guruvayur is designed specifically for families who want:`,
    ``,
    `* A peaceful, private villa close to the temple`,
    `* Comfortable shared spaces for large family groups`,
    `* A safe, homely environment (not a hotel crowd setup)`,
    `* Support for smooth local travel and Kerala experience planning`,
    ``,
    `We also help many families plan their Kerala stay beyond Guruvayur — Wildlife, Hill Station, Ayurvedic experiences, Kerala martial arts programs, temple visits, and curated local experiences through our trusted network.`,
    ``,
    // Per tenant: another host's guests should not be sent to this villa's
    // website. Omitted entirely when the tenant has no experiences link.
    ...(CONFIG.marketing?.experiencesUrl
      ? [`${ic.link}${CONFIG.marketing.experiencesLabel || 'Explore local experiences'}: ${CONFIG.marketing.experiencesUrl}`]
      : []),
  ]
}

// Up front, before the dates, so the guest sees what they would be getting
// before they read what it costs. WhatsApp builds its link-preview card from
// the FIRST link in a message, so this is also what the card shows. Per
// tenant: left out (along with its spacer line) when the tenant has no villa
// page, so another host's guests are never sent to this villa's website.
function villaPicturesBlock(ic) {
  return CONFIG.marketing?.villaDetailsUrl
    ? [`${ic.camera}Villa pictures and details: ${CONFIG.marketing.villaDetailsUrl}`, ``]
    : []
}

function linksBlock(ic) {
  return [
    ...(CONFIG.marketing?.faqUrl
      ? [`${ic.question}FAQs: ${CONFIG.marketing.faqUrl}`] : []),
  ]
}

function signoffBlock(ic, closingLine) {
  return [
    ``,
    closingLine,
    ``,
    `സസ്നേഹം (Sasneham)`,
    ...(CONFIG.ownerName ? [`${CONFIG.ownerName}`] : []),
    `${CONFIG.brandName}`,
    ...(CONFIG.checkinAddress?.phone
      ? [`${ic.phone}${CONFIG.checkinAddress.phone}  (GPay available)`] : []),
  ]
}

// ── Opening and closing lines that depend on who is being written to ──
// A first enquiry ("Thank you for reaching out ... we have checked your dates and the villa is available") reads wrongly to a guest who already holds a
// booking through a platform, so when c.partnerLabel is set (the Complete booking "Go direct?" card) the lines say that instead. Nothing here tells the
// guest to leave the platform: the quote states our direct rate and invites them to ask; the conversation is the owner's.
function introLine(c) {
  return c.partnerLabel
    ? `This is Biji from Luxury Villas of Guruvayur. Thank you for booking our villa through ${c.partnerLabel}.`
    : `This is Biji from Luxury Villas of Guruvayur. Thank you for reaching out.`
}
function datesIntroLine(c) {
  return c.partnerLabel ? `Your stay is booked for:` : `We have checked your dates and the villa is available:`
}
function closingLine(c, rich) {
  const tail = `We make every effort to respond to you with the best experience throughout your journey, so please respond to us with whatever decision you may make. We look forward to making your stay a memorable one.${rich ? ' 🙏' : ''}`
  return c.partnerLabel
    ? `If you would like to book with us directly for these dates, just let me know and I will arrange it. ${tail}`
    : `If this works for your plans, I can go ahead and block the dates for you. ${tail}`
}

// ── Default: no discount, no B2B — standard first-contact quote ──
function buildQuoteDefault(e, rich) {
  const c = quoteCore(e)
  const ic = icons(rich)
  return [
    `Namaskaram ${c.firstName},`,
    ``,
    introLine(c),
    ``,
    `Your family friendly villa closest to the Guruvayur Temple in an Upscale neighborhood with ample parking - A Private Villa`,
    ``,
    ...villaPicturesBlock(ic),
    datesIntroLine(c),
    `${ic.calendar}Check-in: ${fmtQuoteDate(e.checkin_date)} (${c.dateNotes.inNote})`,
    `${ic.calendar}Check-out: ${fmtQuoteDate(e.checkout_date)} (${c.dateNotes.outNote})`,
    ``,
    ...(CONFIG.marketing?.faqUrl
      ? [`${ic.link}Timings: ${CONFIG.marketing.faqUrl}`] : []),
    ``,
    `${ic.villa}Villa: ${c.bedroomCount} Bedrooms | Fully A/C | Private family villa`,
    `${ic.guests}Guests: ${c.guestCount}`,
    ...pricingLines(c, ic.money, 'Your Direct Booking Rate'),
    `(Can include early check-in / late check-out flexibility where possible with minimal charges)`,
    ``,
    ...familiesBlock(ic),
    ``,
    ...linksBlock(ic),
    ...signoffBlock(ic, closingLine(c, rich)),
  ].join('\n')
}

// ── Repeat / loyalty guest — lead with the discount, make it feel special ──
function buildQuoteRepeatDiscount(e, rich) {
  const c = quoteCore(e)
  const ic = icons(rich)
  const label = e.discount_category
    ? (DISCOUNT_CATEGORIES.find(cat => cat.id === e.discount_category)?.label || 'Valued Guest')
    : 'Returning Guest'
  const pct = e.discount_category ? e.discount_pct : e.repeat_discount_pct
  return [
    `Namaskaram ${c.firstName},`,
    ``,
    `This is Biji from Luxury Villas of Guruvayur. Wonderful to hear from you again — it's always a pleasure to welcome back our guests!`,
    ``,
    ...villaPicturesBlock(ic),
    `We have checked your dates and the villa is available:`,
    `${ic.calendar}Check-in: ${fmtQuoteDate(e.checkin_date)} (${c.dateNotes.inNote})`,
    `${ic.calendar}Check-out: ${fmtQuoteDate(e.checkout_date)} (${c.dateNotes.outNote})`,
    ``,
    ...(CONFIG.marketing?.faqUrl
      ? [`${ic.link}Timings: ${CONFIG.marketing.faqUrl}`] : []),
    ``,
    `${ic.villa}Villa: ${c.bedroomCount} Bedrooms | Fully A/C | Private family villa`,
    `${ic.guests}Guests: ${c.guestCount}`,
    ``,
    ...seasonLines(c, ic),
    `${ic.gift}As a ${label}, we're delighted to offer you a special discounted rate this time!`,
    `${ic.money}Regular Tariff: ${fmt(c.quoteAmount)}`,
    `${ic.gift}${label} Discount (${pct}%): −${fmt(c.discountAmount)}`,
    ...pricingLines(c, ic.sparkle, 'Your Special Rate'),
    `(Can include early check-in / late check-out flexibility where possible with minimal charges)`,
    ``,
    `Thank you for continuing to choose us — we truly value your loyalty and look forward to hosting you again.${rich ? ' 🌿' : ''}`,
    ``,
    ...linksBlock(ic),
    ...signoffBlock(ic, `If this works for your plans, I can go ahead and block the dates for you.`),
  ].join('\n')
}

// ── B2B / travel partner — call out the commission clearly and positively ──
function buildQuoteB2B(e, rich) {
  const c = quoteCore(e)
  const ic = icons(rich)
  const label = DISCOUNT_CATEGORIES.find(cat => cat.id === e.discount_category)?.label || 'Partner'
  return [
    `Namaskaram ${c.fullName},`,
    ``,
    `This is Biji from Luxury Villas of Guruvayur. Thank you for checking availability with us for your guest's stay in Guruvayur.`,
    ``,
    ...villaPicturesBlock(ic),
    `We have checked the dates and the villa is available:`,
    `${ic.calendar}Check-in: ${fmtQuoteDate(e.checkin_date)} (${c.dateNotes.inNote})`,
    `${ic.calendar}Check-out: ${fmtQuoteDate(e.checkout_date)} (${c.dateNotes.outNote})`,
    ``,
    ...(CONFIG.marketing?.faqUrl
      ? [`${ic.link}Timings: ${CONFIG.marketing.faqUrl}`] : []),
    ``,
    `${ic.villa}Villa: ${c.bedroomCount} Bedrooms | Fully A/C | Private family villa`,
    `${ic.guests}Guests: ${c.guestCount}`,
    ``,
    ...seasonLines(c, ic),
    `${ic.handshake}As our valued ${label}, here's your special partner pricing:`,
    `${ic.money}Guest-facing Tariff: ${fmt(c.quoteAmount)}`,
    `${ic.handshake}Your Commission (${e.discount_pct}%): ${fmt(c.discountAmount)}`,
    ...pricingLines(c, ic.check, 'Net Payable to Us'),
    ``,
    `You're welcome to quote your guest up to ${fmt(c.quoteAmount)} — your margin is built right in. Looking forward to a great partnership on this booking!${rich ? ' 🌿' : ''}`,
    ``,
    ...linksBlock(ic),
    ...signoffBlock(ic, `If this works, let me know and I'll go ahead and block the dates.`),
  ].join('\n')
}

// ── Direct offer: a guest who already holds a platform booking, shown our direct rate with a discount (the "Go direct?" card) ──
// The layout of the returning-guest version (the regular price, then the discount, then the special rate) with the first-contact version's "why families
// choose us" block, and words for a guest who is not new to these dates but may be new to us. Only built when e.discount_category === 'direct_offer',
// which only the card sets; e.discount_pct is the percentage, e.discount_amount the rupees.
function buildQuoteDirectOffer(e, rich) {
  const c = quoteCore(e)
  const ic = icons(rich)
  return [
    `Namaskaram ${c.firstName},`,
    ``,
    introLine(c),
    ``,
    ...villaPicturesBlock(ic),
    datesIntroLine(c),
    `${ic.calendar}Check-in: ${fmtQuoteDate(e.checkin_date)} (${c.dateNotes.inNote})`,
    `${ic.calendar}Check-out: ${fmtQuoteDate(e.checkout_date)} (${c.dateNotes.outNote})`,
    ``,
    ...(CONFIG.marketing?.faqUrl
      ? [`${ic.link}Timings: ${CONFIG.marketing.faqUrl}`] : []),
    ``,
    `${ic.villa}Villa: ${c.bedroomCount} Bedrooms | Fully A/C | Private family villa`,
    `${ic.guests}Guests: ${c.guestCount}`,
    ``,
    ...seasonLines(c, ic),
    `${ic.gift}Booking with us directly, here is a special rate for you:`,
    `${ic.money}Regular Tariff: ${fmt(c.quoteAmount)}`,
    `${ic.gift}Direct Booking Discount (${e.discount_pct}%): −${fmt(c.discountAmount)}`,
    ...pricingLines(c, ic.sparkle, 'Your Direct Rate'),
    `(Can include early check-in / late check-out flexibility where possible with minimal charges)`,
    ``,
    ...familiesBlock(ic),
    ``,
    ...linksBlock(ic),
    ...signoffBlock(ic, closingLine(c, rich)),
  ].join('\n')
}

// rich=true for "Generate & copy" (colorful, safe for copy/paste),
// rich=false for the "Send quote in WhatsApp" wa.me link (BMP-safe only —
// see buildQuoteWaLink).
export function buildQuote(e, rich = true) {
  const isB2B = e.discount_category === 'b2b_india' || e.discount_category === 'b2b_intl'
  const isRepeatDiscount = !isB2B && (
    ['loyal_patron', 'elite_guest', 'platinum_guest'].includes(e.discount_category) ||
    (!e.discount_category && (e.repeat_discount_pct || 0) > 0)
  )
  if (e.discount_category === 'direct_offer') return buildQuoteDirectOffer(e, rich)
  if (isB2B) return buildQuoteB2B(e, rich)
  if (isRepeatDiscount) return buildQuoteRepeatDiscount(e, rich)
  return buildQuoteDefault(e, rich)
}
