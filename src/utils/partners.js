// Booking platforms ("partners"): who a booking came through, what that platform keeps of it, and how it behaves.
//
// NOTHING about a platform is written in this file. What a platform is called, how it is spelled in the data, its colours, its
// commission, whether it itemises its fees, how its bookings reach us: all of it is read from the partner files in /partners
// (the library) and from the host's own `partners` block in hosts/<id>/config.js, which lists the partners the host uses and
// overrides only what differs for it. A new platform is a new file, or an entry in a host's config: no change here.
// Pure (no clock, no database), so the screens, the Worker and the tests share it.
import { PARTNER_LIBRARY, FALLBACK_COLORS } from '../../partners/index.js'

// ── names ─────────────────────────────────────────────────────────────────
// Stays store whatever the booking form sent ('Booking.com', 'booking_com', 'airbnb'...) and calendar feeds store what the owner
// typed, so names are compared by a normalised key rather than as written (shared by the Worker's hub calendar and the Channel
// calendar screen, so the two can never disagree about which platform a name means).
export const normKey = name => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// normalised spelling -> the partner's id, for every spelling a partner file lists
const ALIAS = {}
for (const p of PARTNER_LIBRARY) {
  ALIAS[normKey(p.id)] = p.id
  for (const n of p.names || []) ALIAS[normKey(n)] = p.id
}

export function channelKey(name) {
  const k = normKey(name)
  return ALIAS[k] || k
}

// The same platform under two spellings ('agoda' / 'agodahomes'). A short key that is the start of a longer one counts, but only
// from 4 letters up, so two unrelated short names can never collide.
export function channelsMatch(a, b) {
  const x = channelKey(a), y = channelKey(b)
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length >= 4 && long.startsWith(short)
}

// ── the host's partners ───────────────────────────────────────────────────
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v)
const isPct = v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100

// A rule with only valid numbers in it: a typo in a config can never zero a fee or break a screen (it is ignored).
function cleanRule(r) {
  if (!isObj(r)) return null
  const out = { ...r }
  for (const k of ['hostPct', 'guestPct']) {
    if (!(k in out)) continue
    if (isPct(out[k])) out[k] = Number(out[k]); else delete out[k]
  }
  return out
}

// The rule in force on a date. `commission` is one rule { hostPct, guestPct } or a list of dated ones
// [{ from: 'YYYY-MM-DD', hostPct, guestPct }, ...]: a booking is worked out under the latest rule that had started by its date, so
// when a platform changes its rules the older bookings keep theirs. No date: the latest rule.
export function commissionRule(partner, onDate) {
  const c = partner && partner.commission
  if (Array.isArray(c)) {
    const rules = c.map(cleanRule).filter(Boolean).sort((a, b) => String(a.from || '').localeCompare(String(b.from || '')))
    if (!rules.length) return { hostPct: 0, guestPct: 0 }
    let pick = rules[0]
    for (const r of rules) if (!onDate || !r.from || String(r.from) <= String(onDate)) pick = r
    return { hostPct: 0, guestPct: 0, ...pick }
  }
  return { hostPct: 0, guestPct: 0, ...(cleanRule(c) || {}) }
}

function mergePartner(base, over) {
  const out = { ...base }
  if (!isObj(over)) return out
  for (const [k, v] of Object.entries(over)) {
    if (k === 'commission' || k === 'calendar') continue
    out[k] = v
  }
  if (over.commission !== undefined && over.commission !== null) {
    out.commission = Array.isArray(over.commission)
      ? over.commission.map(cleanRule).filter(Boolean)
      : { ...commissionRule(base), ...(cleanRule(over.commission) || {}) }
  }
  if (isObj(base.calendar) || isObj(over.calendar)) out.calendar = { ...(base.calendar || {}), ...(over.calendar || {}) }
  return out
}

const byId = id => PARTNER_LIBRARY.find(p => p.id === channelKey(id)) || null

// The partners THIS host works with, in the order its config lists them: the library's file for each, with the host's own entry laid
// over it. An id the library has never heard of is a partner defined entirely in the host's config. A config with no `partners` block
// at all (one stored before partners existed) gets the usual set.
// (A screen asks once per booking row, so the merged list is kept per config object: a config that is replaced is a new object.)
const MERGED = new WeakMap()
let USUAL = null
export function hostPartners(config) {
  const listed = config && config.partners
  if (isObj(listed)) {
    if (MERGED.has(listed)) return MERGED.get(listed)
    const out = Object.keys(listed).map(id => {
      const base = byId(id) || { id: normKey(id), label: id, group: 'channel', names: [normKey(id)], commission: { hostPct: 0, guestPct: 0 }, feeBreakdown: false, bookingsFrom: 'calendar' }
      return mergePartner(base, listed[id])
    })
    MERGED.set(listed, out)
    return out
  }
  if (!USUAL) {
    const usual = PARTNER_LIBRARY.filter(p => p.group !== 'channel' || p.legendRank)
    const rank = p => (p.group === 'direct' ? 0 : p.group === 'channel' ? 1 : 2)
    USUAL = usual.slice().sort((a, b) => rank(a) - rank(b) || (a.legendRank || 0) - (b.legendRank || 0)).map(p => ({ ...p }))
  }
  return USUAL
}

// The partner a booking source (or a calendar's name) belongs to: the host's own entry if it lists one, else the library's file.
// Matched by key, so 'Booking.com', 'booking_com' and 'booking' are one. null for a name nobody has described.
export function partnerFor(config, source) {
  const k = channelKey(source)
  if (!k) return null
  const mine = hostPartners(config).find(p => channelKey(p.id) === k || (p.names || []).some(n => channelKey(n) === k))
  return mine || byId(k)
}

// ── what a platform keeps ─────────────────────────────────────────────────
// The percentage of the booking (night fee + cleaning fee) the platform keeps from the host's payout, 0 for a name nobody described.
export function commissionPct(config, source, onDate) {
  return commissionRule(partnerFor(config, source), onDate).hostPct
}

// A percentage of an amount, to the paisa: 38,016 at 15.5% is 5,892.48.
export const percentOf = (amount, pct) => Math.round((Number(amount) || 0) * (Number(pct) || 0)) / 100

const num = (row, ...keys) => {
  for (const k of keys) { const v = Number(row && row[k]); if (Number.isFinite(v) && v !== 0) return v }
  return 0
}

// What a platform takes on ONE booking, in total. A platform that itemises its fees (`feeBreakdown`) takes its host service fee
// plus any guest service fee, read from the amounts the booking holds, so an older booking shows what was really charged, not
// today's rate. For a platform that gives only a percentage, it is the commission worked out from the rate when the booking's
// money was saved (`estimated`). `pct` is the total as a percentage of the booking (night fee + cleaning fee, else the gross
// without extras). null for a booking that is not through a platform, or holds no fees yet. A stay row as the API gives it
// (snake_case) or as a screen holds it (camelCase).
export function platformTake(stay, config) {
  if (!stay) return null
  const p = partnerFor(config, stay.source)
  if (!p || p.group !== 'channel') return null
  const itemised = p.feeBreakdown === true
  const host = itemised ? (num(stay, 'host_service_fee', 'hostServiceFee') || num(stay, 'commission_amt', 'commissionAmt')) : num(stay, 'commission_amt', 'commissionAmt')
  const guest = itemised ? num(stay, 'guest_service_fee', 'guestServiceFee') : 0
  const total = Math.round((host + guest) * 100) / 100
  if (!(total > 0)) return null
  let base = num(stay, 'night_fee', 'nightFee') + num(stay, 'cleaning_fee', 'cleaningFee')
  if (!(base > 0)) base = Math.max(0, num(stay, 'gross') - num(stay, 'extra_charges', 'extraCharges'))
  return {
    partner: p, label: p.label, estimated: !itemised,
    host, guest, total,
    base: base > 0 ? base : null,
    pct: base > 0 ? Math.round(total / base * 1000) / 10 : null,
  }
}

// ── names, colours and styles ─────────────────────────────────────────────
const LABEL_BY_NAME = {}
for (const p of PARTNER_LIBRARY) for (const n of p.names || []) LABEL_BY_NAME[String(n).toLowerCase()] = p.label

// 'booking_com' -> 'Booking.com'; a name nobody described is Title-cased, so a brand-new platform shows correctly with no change.
export function channelLabel(source) {
  const s = (source || '').trim().toLowerCase()
  if (!s) return (PARTNER_LIBRARY.find(p => p.group === 'direct') || {}).label || 'Direct'
  if (LABEL_BY_NAME[s]) return LABEL_BY_NAME[s]
  return s.split(/[\s._-]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const OWN = g => PARTNER_LIBRARY.find(p => p.group === g)
const styleOf = (p, key) => ({ group: p.group, key: key || p.id, label: p.label, color: p.color, text: p.textColor })

export const DIRECT_STYLE = styleOf(OWN('direct'))
export const AGENT_STYLE = styleOf(OWN('agent'))
const OTHER_STYLE = styleOf(OWN('other'))

const DIRECT_KEYS = new Set(['', ...[OWN('direct').id, ...(OWN('direct').names || []), ...(OWN('direct').doors || [])].map(normKey)])
const AGENT_PREFIX = new RegExp('^(' + (OWN('agent').prefixes || ['agent']).map(normKey).join('|') + ')')

// The partners always listed on the calendar screens (those with a legendRank), in that order, and the known ones listed only when used.
const channelPartners = PARTNER_LIBRARY.filter(p => p.group === 'channel')
export const PARTNERS = channelPartners.filter(p => p.legendRank).sort((a, b) => a.legendRank - b.legendRank)
  .map(p => ({ key: p.id, label: p.label, color: p.color, text: p.textColor }))
const MORE_PARTNERS = channelPartners.filter(p => !p.legendRank).map(p => ({ key: p.id, label: p.label, color: p.color, text: p.textColor }))

// { group: 'channel' | 'direct' | 'agent' | 'other', key, label, color, text } for a booking source. All the direct doors share one
// key, so they add up as one in a tally; a platform nobody described gets a stable colour picked from its name.
export function sourceStyle(source) {
  const k = channelKey(source)
  if (DIRECT_KEYS.has(k)) return DIRECT_STYLE
  if (AGENT_PREFIX.test(k)) return AGENT_STYLE
  if (k === normKey(OWN('other').id)) return OTHER_STYLE
  const p = PARTNERS.concat(MORE_PARTNERS).find(x => channelsMatch(k, x.key))
  if (p) return { group: 'channel', key: p.key, label: p.label, color: p.color, text: p.text }
  let hash = 0
  for (const ch of k) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return { group: 'channel', key: k, label: channelLabel(source), color: FALLBACK_COLORS[hash % FALLBACK_COLORS.length], text: '#FFFFFF' }
}

// Is this source one of the host's own direct bookings (no name, 'direct')? Used for the green "Direct" tag.
export function isDirectSource(source) {
  const s = (source || '').trim().toLowerCase()
  return !s || (OWN('direct').names || []).includes(s)
}

// How a source reads on ANOTHER platform's calendar ("Unavailable (Airbnb)"): the platform's name; "Direct" for the host's own
// doors, agents and anything else the host takes itself; null for a name nobody described.
export function hubLabelFor(source) {
  const k = channelKey(source)
  if (!k) return OWN('direct').hubLabel || OWN('direct').label
  for (const p of PARTNER_LIBRARY) {
    const own = p.group !== 'channel'
    const exact = [p.id, ...(p.names || []), ...(own ? (p.doors || []) : [])].map(normKey)
    if (exact.includes(k)) return own ? (p.hubLabel || p.label) : p.label
  }
  return null
}
