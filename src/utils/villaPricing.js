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

import { CONFIG } from '../config'

export const OVERFLOW_PER_GUEST_PER_NIGHT = CONFIG.pricing.overflowPerGuestPerNight
export const OVERFLOW_MAX_RECOMMENDED = CONFIG.pricing.overflowMaxRecommended
export const RATE_CARD_MAX_GUESTS = CONFIG.pricing.rateCardMaxGuests

// ~2 guests/bedroom as a simple display estimate (not an occupancy rule) —
// once billable guests exceed 2x a villa's bedroom count, the bedroom count
// shown just stays capped rather than implying more bedrooms exist.
export const VILLA_BEDROOMS = Object.fromEntries(CONFIG.villas.map(v => [v.id, v.bedrooms]))
export const GUESTS_PER_BEDROOM = 2

export function getBedroomEstimate(villaId, billableGuests) {
  const maxBedrooms = VILLA_BEDROOMS[villaId] || VILLA_BEDROOMS.dwarka
  if (!billableGuests || billableGuests <= 0) return maxBedrooms
  return Math.min(maxBedrooms, Math.ceil(billableGuests / GUESTS_PER_BEDROOM))
}

// Fallback rate card used only if the backend rate-card fetch hasn't completed yet
// or fails — mirrors the seeded `villa_rate_cards` table exactly. The backend table
// is the source of truth; this just avoids a blank UI on a slow/failed fetch.
export const FALLBACK_RATE_CARDS = CONFIG.pricing.fallbackRateCards

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
export const DISCOUNT_CATEGORIES = CONFIG.pricing.discountCategories

export function getDefaultDiscountPct(categoryId) {
  return DISCOUNT_CATEGORIES.find(c => c.id === categoryId)?.defaultPct ?? 0
}

// ── EXTRA CHARGE LINE ITEMS ────────────────────────────────────
// Shared preset list for ad-hoc priced line items (e.g. "Additional Guest"),
// used both on confirmed stays (CompleteBooking.jsx) and on enquiry quotes
// (EnquiryDetail.jsx) before a booking is confirmed.
export const EXTRA_ITEMS = CONFIG.pricing.extraItems
