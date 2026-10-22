import { CONFIG } from '../config'

// The types, the split and how it is written down are in breakfastSplit.js (pure, so the Worker can
// bundle them too); the guest form imports them from here.
export { BREAKFAST_MAX_TYPES, joinBreakfastTypes } from './breakfastSplit'

// Breakfast is charged per person. A host can give a big party a lower rate: breakfastGroupRate applies
// once the party is MORE than breakfastGroupAbove people (Dwarka: 250 above 10, 275 up to 10). A tenant
// that sets neither keeps one rate for everybody.
export function breakfastRateFor(guests, cfg = CONFIG) {
  const base  = Number(cfg?.breakfastRate) || 0
  const group = Number(cfg?.breakfastGroupRate) || 0
  const above = Number(cfg?.breakfastGroupAbove) || 0
  return group > 0 && above > 0 && (Number(guests) || 0) > above ? group : base
}
