// Party-size rules shared by the guest check-in form and the Worker that receives it. Pure: no CONFIG
// import, so the Worker can bundle it.
//
// A villa's rate card prices parties up to a maximum (pricing.rateCardMaxGuests: Dwarka 12, the demo
// 10). The check-in form lets a guest register that many adults, and asks one whose party is bigger
// (adults and children together) to confirm the number with the host afterwards: beyond the card,
// overflow charges and extra beds apply and the host has to agree them. A note, never a block.

export const DEFAULT_PARTY_LIMIT = 12

export function partyLimit(pricing) {
  return Number(pricing?.rateCardMaxGuests) || DEFAULT_PARTY_LIMIT
}

// Read the two counts the way the form's payload and the Worker's storage do (an unset adults is 1).
export function partyOf(adults, children) {
  return (parseInt(adults, 10) || 1) + (parseInt(children, 10) || 0)
}

export function overPartyLimit(adults, children, limit = DEFAULT_PARTY_LIMIT) {
  return partyOf(adults, children) > limit
}
