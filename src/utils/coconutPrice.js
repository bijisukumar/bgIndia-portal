// ============================================================
//  THE COCONUT BOARD'S PRICE, AND HOW OLD IT IS
//
//  getCoconutMarketPrice scrapes coconutboard.in, which prints its own date
//  beside each figure as dd/mm/yyyy. That date is when the QUOTE was taken,
//  not when we looked: the board does not publish every day, and a weekend or
//  a holiday leaves the last figure standing.
//
//  So a card headed "market price today" is a claim the data cannot support.
//  It was headed exactly that on the estate manager's home screen, over a
//  figure that was three days old the morning this was written. These turn
//  the board's string into something the screens can be honest about.
//
//  Pure, no imports, shared by every screen that shows the price so they
//  cannot disagree about what day it is from.
// ============================================================

// '12/11/2026' -> '2026-11-12'. Anything else -> null, including the empty
// string the board prints for a market it has no figure for.
export function boardDateToIso(raw) {
  const m = String(raw == null ? '' : raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  // A real date, not 31/02. Date rolls those over, so compare what comes back.
  const back = new Date(iso + 'T00:00:00Z')
  return back.toISOString().slice(0, 10) === iso ? iso : null
}

// The newest date across the markets we show, and how many days back that is.
// Entries are the {price, date} objects the Worker returns; a missing market
// is simply skipped rather than counted as old.
export function marketAge(entries, todayIso) {
  const isos = (entries || [])
    .map(e => boardDateToIso(e && e.date))
    .filter(Boolean)
    .sort()
  const newest = isos.length ? isos[isos.length - 1] : null
  if (!newest || !/^\d{4}-\d{2}-\d{2}$/.test(String(todayIso || ''))) return { newest, daysOld: null }
  const daysOld = Math.round((new Date(todayIso + 'T00:00:00Z') - new Date(newest + 'T00:00:00Z')) / 86400000)
  return { newest, daysOld }
}

// What to say about that age, in words the owner can act on. Deliberately says
// nothing when there is no date: an unlabelled price is better than one
// labelled with a guess.
export function ageLabel(daysOld) {
  if (daysOld === null || daysOld === undefined) return ''
  if (daysOld <= 0) return "today's quote"
  if (daysOld === 1) return "yesterday's quote"
  return `${daysOld} days old`
}
