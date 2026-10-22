// Breakfast types and how a split is written down. Pure (no CONFIG import), so the Worker can bundle it.
//
// A stay's breakfast request is one line of text, stayvibe_stay_prefs.breakfast_choice, which every
// screen and the check-in emails print as it is:
//   "Appam"                one type, no count (a guest who ticked one on the check-in form)
//   "Idli + Appam"         a split the guest ticked on the form: types, no counts
//   "Appam ×5 + Idli ×5"   what the host recorded in Guest info: how many of each
// The counts are the host's word for what to cook, so they need not add up to the number of guests.

export const BREAKFAST_TYPES = ['Idli', 'Puttu', 'Appam']   // the first word of each item on the menu

// The kitchen cannot cook a different breakfast for every person, so the GUEST's split (ticked on the
// check-in form) is at most two types. The host's own counts in Guest info are not limited this way.
export const BREAKFAST_MAX_TYPES = 2

const rank = t => { const i = BREAKFAST_TYPES.indexOf(t); return i === -1 ? BREAKFAST_TYPES.length : i }
const byMenu = (a, b) => rank(a.type) - rank(b.type) || a.type.localeCompare(b.type)
const whole = n => Math.floor(Number(n))

// The types a guest ticked on the form, in menu order: "Idli + Appam".
export function joinBreakfastTypes(menu, ticked) {
  return menu.filter(k => ticked.includes(k)).join(' + ')
}

// [{ type, count }] -> "Appam ×5 + Idli ×5", in menu order; a zero or missing count is left out.
export function formatBreakfast(items) {
  return (items || [])
    .filter(it => it && it.type && whole(it.count) > 0)
    .sort(byMenu)
    .map(it => `${it.type} ×${whole(it.count)}`)
    .join(' + ')
}

// "Appam ×5 + Idli ×5" -> { items: [{ type: 'Appam', count: 5 }, ...], total: 10 }. A type with no count
// ("Idli + Appam") comes back with count null, and then there is no total: nobody has said how many.
export function parseBreakfast(text) {
  const items = String(text || '').split('+').map(s => s.trim()).filter(Boolean).map(tok => {
    const m = tok.match(/^(.*?)\s*[×x*]\s*(\d+)$/i)
    return m ? { type: m[1].trim(), count: Number(m[2]) } : { type: tok, count: null }
  })
  const counted = items.length > 0 && items.every(i => i.count != null)
  return { items, total: counted ? items.reduce((n, i) => n + i.count, 0) : null }
}

// What Raman starts a breakfast entry from: the host's total when counts were given, else `fallback`.
export function breakfastCount(text, fallback) {
  const t = parseBreakfast(text).total
  return t == null ? fallback : t
}

// "Appam ×5, Idli ×5" (or "Idli, Appam" with no counts) for a one-line summary.
export function breakfastList(text) {
  return parseBreakfast(text).items.map(i => (i.count != null ? `${i.type} ×${i.count}` : i.type)).join(', ')
}

// Guest info's editor: the count typed for each type, as strings ({ Appam: '5', Idli: '5' }). A request
// with counts shows them; one with a single type and no count starts at the whole party (the usual
// meaning); a split with no counts starts blank, for the host to fill in. Nothing is written unless the
// host changes it (the screen compares with how it opened).
export function breakfastDraft(text, party) {
  const { items } = parseBreakfast(text)
  const draft = {}
  for (const it of items) {
    draft[it.type] = it.count != null ? String(it.count) : (items.length === 1 && party > 0 ? String(party) : '')
  }
  return draft
}

// The editor's typed counts -> [{ type, count }], zero and blank left out.
export function breakfastItems(draft) {
  return Object.entries(draft || {})
    .map(([type, count]) => ({ type, count: whole(count) }))
    .filter(it => it.count > 0)
}

// The types the editor offers: the menu, plus any other type already on the request so it is not lost.
export function breakfastTypesFor(text) {
  const extra = parseBreakfast(text).items.map(i => i.type).filter(t => !BREAKFAST_TYPES.includes(t))
  return [...BREAKFAST_TYPES, ...extra]
}

// Check what the editor sends: a list of { type, count }. Returns it cleaned (a type's spelling put back
// to the menu's, counts per type added up, zeros dropped), or null when it is not such a list.
export function cleanBreakfast(items) {
  if (!Array.isArray(items) || items.length > 12) return null
  const total = new Map()
  for (const it of items) {
    const raw = String(it && it.type != null ? it.type : '').trim()
    if (!/^[A-Za-z][A-Za-z ]{0,23}$/.test(raw)) return null
    const count = Number(it.count)
    if (!Number.isInteger(count) || count < 0 || count > 99) return null
    const type = BREAKFAST_TYPES.find(t => t.toLowerCase() === raw.toLowerCase()) || raw
    if (count > 0) total.set(type, (total.get(type) || 0) + count)
  }
  return [...total].map(([type, count]) => ({ type, count }))
}
