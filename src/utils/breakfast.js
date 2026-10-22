import { CONFIG } from '../config'

// Breakfast is charged per person. A host can give a big party a lower rate: breakfastGroupRate applies
// once the party is MORE than breakfastGroupAbove people (Dwarka: 250 above 10, 275 up to 10). A tenant
// that sets neither keeps one rate for everybody.
export function breakfastRateFor(guests, cfg = CONFIG) {
  const base  = Number(cfg?.breakfastRate) || 0
  const group = Number(cfg?.breakfastGroupRate) || 0
  const above = Number(cfg?.breakfastGroupAbove) || 0
  return group > 0 && above > 0 && (Number(guests) || 0) > above ? group : base
}

// The kitchen cannot cook a different breakfast for every person, so a split is at most two types.
export const BREAKFAST_MAX_TYPES = 2

// What is stored and shown ("Breakfast — Idli + Appam"): the ticked types, in menu order.
export function joinBreakfastTypes(menu, ticked) {
  return menu.filter(k => ticked.includes(k)).join(' + ')
}
