// Shared villa tariff pricing logic.
//
// Built from the owner-supplied per-night rate table for Dwarka (1-12 billable
// guests), generalised to be villa-keyed so it can support other villas later
// without a rewrite. Deliberately NOT tied to the enquiry screen only — this
// module is meant to be reused by a future guest-facing "quick pricing" screen
// so guests can self-serve a tariff estimate without waiting on the owner.
//
// PRICING RULES (confirmed with the owner):
// - Per night, not a flat total — multiply tariff-per-night by number of nights.
// - "Billable guests" = adults + children. Infants (1 yr and under) are free
//   and excluded from the lookup entirely.
// - For 1-12 billable guests, look up the exact rate-card row.
// - Above 12 billable guests, each extra guest adds ₹750/guest/night on top of
//   the 12-guest tariff (floor-bed pricing), with a recommended max of 4 extra
//   guests (i.e. comfortably supports up to 16 before flagging it as outside
//   the recommended range — booking is still allowed, just surfaced as a note).

export const OVERFLOW_PER_GUEST_PER_NIGHT = 750
export const OVERFLOW_MAX_RECOMMENDED = 4
export const RATE_CARD_MAX_GUESTS = 12

// Fallback rate card used only if the backend rate-card fetch hasn't completed yet
// or fails — mirrors the seeded `villa_rate_cards` table exactly. The backend table
// is the source of truth; this just avoids a blank UI on a slow/failed fetch.
export const FALLBACK_RATE_CARDS = {
  dwarka: [
    { guests: 1, tariff: 4896 }, { guests: 2, tariff: 4896 }, { guests: 3, tariff: 6037 },
    { guests: 4, tariff: 7178 }, { guests: 5, tariff: 8319 }, { guests: 6, tariff: 9460 },
    { guests: 7, tariff: 10601 }, { guests: 8, tariff: 11743 }, { guests: 9, tariff: 12884 },
    { guests: 10, tariff: 14025 }, { guests: 11, tariff: 15166 }, { guests: 12, tariff: 16307 },
  ],
}

/**
 * Look up the per-night tariff for a given villa + billable guest count.
 * @param {Array<{guests:number, tariff:number}>} rateCard - rows for one villa, ascending by guests
 * @param {number} billableGuests - adults + children (infants excluded)
 * @returns {{ tariffPerNight: number, overflowGuests: number, withinRecommended: boolean }}
 */
export function getTariffPerNight(rateCard, billableGuests) {
  if (!rateCard || rateCard.length === 0 || billableGuests <= 0) {
    return { tariffPerNight: 0, overflowGuests: 0, withinRecommended: true }
  }
  const sorted = [...rateCard].sort((a, b) => a.guests - b.guests)
  const maxRow = sorted[sorted.length - 1]

  const exactRow = sorted.find(r => r.guests === billableGuests)
  if (exactRow) {
    return { tariffPerNight: exactRow.tariff, overflowGuests: 0, withinRecommended: true }
  }

  if (billableGuests < sorted[0].guests) {
    // Below the smallest defined row — use the smallest row's rate as a floor.
    return { tariffPerNight: sorted[0].tariff, overflowGuests: 0, withinRecommended: true }
  }

  // Above the top of the rate card — apply floor-bed overflow pricing.
  const overflowGuests = billableGuests - maxRow.guests
  const tariffPerNight = maxRow.tariff + overflowGuests * OVERFLOW_PER_GUEST_PER_NIGHT
  return {
    tariffPerNight,
    overflowGuests,
    withinRecommended: overflowGuests <= OVERFLOW_MAX_RECOMMENDED,
  }
}

/**
 * Full estimate for an enquiry: adults + children (billable) + infants (free) over N nights.
 * @returns {{ tariffPerNight:number, nights:number, total:number, billableGuests:number, overflowGuests:number, withinRecommended:boolean }}
 */
export function getTariffEstimate(rateCard, { adults = 0, children = 0, nights = 0 }) {
  const billableGuests = (Number(adults) || 0) + (Number(children) || 0)
  const { tariffPerNight, overflowGuests, withinRecommended } = getTariffPerNight(rateCard, billableGuests)
  const safeNights = Math.max(0, Number(nights) || 0)
  return {
    tariffPerNight,
    nights: safeNights,
    total: tariffPerNight * safeNights,
    billableGuests,
    overflowGuests,
    withinRecommended,
  }
}

// ── DISCOUNT CATEGORIES ───────────────────────────────────────
// Mutually exclusive — an enquiry has at most one of these (or none).
// Defaults are starting points the owner can tune per enquiry or globally later.
export const DISCOUNT_CATEGORIES = [
  { id: 'loyal_patron', label: 'Loyal Patron / Valued Return Guest / Preferred Guest', defaultPct: 10 },
  { id: 'elite_guest', label: 'Elite Guest', defaultPct: 15 },
  { id: 'platinum_guest', label: 'Platinum Guest', defaultPct: 20 },
  { id: 'b2b_india', label: 'B2B – India', defaultPct: 15 },
  { id: 'b2b_intl', label: 'B2B – International', defaultPct: 20 },
]

export function getDefaultDiscountPct(categoryId) {
  return DISCOUNT_CATEGORIES.find(c => c.id === categoryId)?.defaultPct ?? 0
}
