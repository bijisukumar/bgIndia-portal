// ============================================================
//  ChannelCalendar.jsx
//  Owner-facing management for OTA iCal sync (Airbnb today; Booking.com,
//  Agoda etc. are just more feed rows — same sync code, no new code needed)
//  plus a merged month calendar showing every channel's booked/blocked
//  dates in one place.
//  Route: /owner/villa/channel-calendar
// ============================================================
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import { channelLabel, channelsMatch, sourceStyle, sourcePill, colorAlpha, PARTNERS, DIRECT_STYLE, AGENT_STYLE } from '../../utils/channel'
import CalendarExports from './CalendarExports'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Colours and groups come from utils/channel.js (sourceStyle): each channel partner has its
// own colour, every direct booking shares one, every agent booking another. Held nights
// (an agreed late check-out / early check-in) are amber and hatched.
const HOLD_COLOR = '#F59E0B'

function pad2(n) { return String(n).padStart(2, '0') }
function toISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c }

// Weeks always run Sun→Sat and pad into the adjacent months so every row is
// a full 7 days — needed to place spanning bars with plain CSS grid columns.
function buildMonthWeeks(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const gridStart = addDays(first, -first.getDay())
  const totalCells = Math.ceil((first.getDay() + last.getDate()) / 7) * 7
  const weeks = []
  let cursor = gridStart
  for (let w = 0; w < totalCells / 7; w++) {
    const week = []
    for (let d = 0; d < 7; d++) { week.push(cursor); cursor = addDays(cursor, 1) }
    weeks.push(week)
  }
  return weeks
}

// Clips each item's [checkinDate, checkoutDate) span to this week's 7 days
// and returns a grid-column start/end (1-indexed, end exclusive) for it —
// lets a multi-night stay render as one continuous bar via CSS grid-column
// spanning instead of repeating per day cell.
function weekSegments(week, items) {
  const weekStartISO = toISO(week[0])
  const weekEndISO = toISO(addDays(week[6], 1))
  const segs = []
  for (const item of items) {
    if (item.checkoutDate <= weekStartISO || item.checkinDate >= weekEndISO) continue
    const segStart = item.checkinDate > weekStartISO ? item.checkinDate : weekStartISO
    const segEnd = item.checkoutDate < weekEndISO ? item.checkoutDate : weekEndISO
    const startIdx = week.findIndex(d => toISO(d) === segStart)
    const endIdx = week.findIndex(d => toISO(d) === segEnd)
    segs.push({
      item,
      startCol: startIdx >= 0 ? startIdx + 1 : 1,
      endCol: endIdx >= 0 ? endIdx + 1 : 8,
    })
  }
  return segs
}

// Nights booked THIS month, per source — clipped to the month's own boundaries so a stay
// spanning a month edge only counts the nights that actually fall inside it, matching what
// the grid itself shows. Bucketed by sourceStyle().key, so every spelling of a platform
// ('booking_com', 'Booking.com') and every direct door (website, WhatsApp, phone...) add up
// together.
function monthNightsTally(items, year, month) {
  const startISO = toISO(new Date(year, month, 1))
  const endISO = toISO(new Date(year, month + 1, 1))
  const byKey = {}
  let total = 0, held = 0
  for (const item of items) {
    if (item.checkoutDate <= startISO || item.checkinDate >= endISO) continue
    // A held night is kept back, not booked: counted on its own, never as a source's.
    if (item.kind === 'hold') { held += 1; continue }
    const clipStart = item.checkinDate > startISO ? item.checkinDate : startISO
    const clipEnd = item.checkoutDate < endISO ? item.checkoutDate : endISO
    const nights = Math.round((new Date(clipEnd) - new Date(clipStart)) / 86400000)
    if (nights <= 0) continue
    const key = sourceStyle(item.source).key
    byKey[key] = (byKey[key] || 0) + nights
    total += nights
  }
  return { byKey, total, held }
}

function CalendarGrid({ items, tally, monthCursor, onPrev, onNext, onToday }) {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month])
  const todayISO = toISO(new Date())

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onPrev} style={styles.navBtn}>‹</button>
          <button onClick={onToday} style={{ ...styles.navBtn, width: 'auto', padding: '0 10px', fontSize: '0.68rem' }}>Today</button>
          <button onClick={onNext} style={styles.navBtn}>›</button>
        </div>
        <div style={{ fontWeight: '700', color: 'var(--gold)', fontSize: '0.95rem' }}>{MONTH_NAMES[month]} {year}</div>
        <div style={{ width: '86px' }} />
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '10px' }}>
        <span style={{ color: 'var(--text)', fontWeight: '700' }}>{tally.total} night{tally.total === 1 ? '' : 's'} booked</span>
        {tally.held > 0 && <span style={{ color: HOLD_COLOR }}>  ·  🔒 {tally.held} held</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: '700', letterSpacing: '0.05em', padding: '2px 0' }}>{w}</div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const segs = weekSegments(week, items)
        return (
          <div key={wi} style={{ marginBottom: '3px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {week.map(d => {
                const inMonth = d.getMonth() === month
                const isToday = toISO(d) === todayISO
                return (
                  <div key={toISO(d)} style={{
                    ...styles.dayCell,
                    opacity: inMonth ? 1 : 0.3,
                    border: isToday ? '1px solid var(--gold)' : styles.dayCell.border,
                  }}>
                    {d.getDate()}
                  </div>
                )
              })}
            </div>
            {segs.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginTop: '2px' }}>
                {segs.map((seg, si) => {
                  const st = sourceStyle(seg.item.source)
                  // A held night (an agreed late check-out / early check-in) is not a booking:
                  // hatched, so it reads as "kept back" rather than as another platform.
                  const isHold = seg.item.kind === 'hold'
                  return (
                    <div key={si} title={isHold ? 'Held night · ' + (seg.item.label || '') : `${channelLabel(seg.item.source)}${seg.item.label ? ' · ' + seg.item.label : ''}`}
                      style={{
                        gridColumn: `${seg.startCol} / ${seg.endCol}`,
                        background: isHold ? 'repeating-linear-gradient(45deg, rgba(245,158,11,0.32) 0 5px, rgba(245,158,11,0.12) 5px 10px)' : st.color,
                        color: isHold ? HOLD_COLOR : st.text,
                        border: isHold ? '1px dashed rgba(245,158,11,0.7)' : 'none',
                        boxSizing: 'border-box',
                        borderRadius: '5px',
                        padding: '3px 6px',
                        fontSize: '0.64rem',
                        fontWeight: '700',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        outline: seg.item.conflict ? '2px solid #EF4444' : 'none',
                        outlineOffset: '1px',
                      }}>
                      {seg.item.conflict && '⚠️ '}{isHold ? '🔒 ' + (seg.item.label || 'Held night') : channelLabel(seg.item.source) + (seg.item.label ? ' · ' + seg.item.label : '')}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// The key to the calendar, in three groups: every CHANNEL PARTNER (a platform), then the
// bookings the villa takes itself (DIRECT) and those that come through an AGENT. Each chip
// carries the colour its bars use and the nights it has in the month on show. A platform
// whose calendar is connected shows ✓; one that is not is a button that opens "+ Feed"
// with that platform filled in, so connecting Vrbo or Booking.com is two taps.
function SourceKey({ items, feeds, tally, onConnect }) {
  const feedFor = key => feeds.find(f => channelsMatch(f.channel, key))
  // Platforms beyond the usual list that this villa really uses: a feed, or a booking.
  const extra = useMemo(() => {
    const seen = new Map()
    const note = src => {
      const st = sourceStyle(src)
      if (st.group === 'channel' && !PARTNERS.some(p => p.key === st.key) && !seen.has(st.key)) seen.set(st.key, st)
    }
    feeds.forEach(f => note(f.channel))
    items.forEach(it => { if (it.kind !== 'hold') note(it.source) })
    return [...seen.values()]
  }, [items, feeds])
  const hasOther = items.some(it => it.kind !== 'hold' && sourceStyle(it.source).group === 'other')
  const hasHolds = items.some(it => it.kind === 'hold')

  const label = { fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: '700', letterSpacing: '0.08em', marginBottom: '6px' }
  const row = { display: 'flex', flexWrap: 'wrap', gap: '6px' }

  function Chip({ st, status, onClick, title }) {
    const n = tally.byKey[st.key] || 0
    const Tag = onClick ? 'button' : 'span'
    return (
      <Tag onClick={onClick} title={title}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px 5px 8px', borderRadius: '999px',
          fontSize: '0.7rem', color: 'var(--text)', fontWeight: n > 0 ? '700' : '500', fontFamily: 'inherit',
          background: colorAlpha(st.color, n > 0 ? 0.18 : 0.06),
          border: `1px ${onClick ? 'dashed' : 'solid'} ${colorAlpha(st.color, onClick ? 0.4 : 0.6)}`,
          cursor: onClick ? 'pointer' : 'default',
        }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: st.color, flexShrink: 0 }} />
        {st.label}
        {n > 0 && <span style={{ color: st.color, fontWeight: '700' }}>{n}n</span>}
        {status}
      </Tag>
    )
  }

  const partnerChip = st => {
    const f = feedFor(st.key)
    if (!f) {
      return <Chip key={st.key} st={st} onClick={() => onConnect(st.label)} title={`${st.label}'s calendar is not connected. Tap to connect it.`}
        status={<span style={{ color: 'var(--text-dim)', fontWeight: '700' }}>+</span>} />
    }
    const bad = f.last_sync_status === 'error'
    const status = bad ? <span style={{ color: '#EF4444' }}>⚠</span> : !f.is_active ? <span style={{ color: 'var(--text-dim)' }}>⏸</span> : <span style={{ color: '#34A853' }}>✓</span>
    const when = bad ? 'last sync failed' : !f.is_active ? 'paused' : f.last_synced_at ? `synced ${f.last_synced_at.slice(0, 16)}` : 'not synced yet'
    return <Chip key={st.key} st={st} status={status} title={`${st.label}'s calendar is connected · ${when}`} />
  }

  return (
    <div style={{ background: 'var(--dark-card)', border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
      <div style={label}>CHANNEL PARTNERS</div>
      <div style={row}>
        {PARTNERS.map(p => partnerChip(sourceStyle(p.key)))}
        {extra.map(st => partnerChip(st))}
      </div>
      <div style={{ ...label, marginTop: '12px' }}>BOOKED WITH YOU</div>
      <div style={row}>
        <Chip st={DIRECT_STYLE} title="Direct bookings: website, WhatsApp, phone, referral and walk-in guests" />
        <Chip st={AGENT_STYLE} title="Agent bookings: a travel agent or sales partner (choose Agent as the booking channel)" />
        {hasOther && <Chip st={sourceStyle('other')} />}
      </div>
      <div style={{ fontSize: '0.64rem', color: 'var(--text-dim)', marginTop: '6px', lineHeight: 1.5 }}>
        Direct: website, WhatsApp, phone, referral · Agent: travel agents and sales partners
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: '10px', paddingTop: '9px', borderTop: '1px solid var(--border-dim)', fontSize: '0.64rem', color: 'var(--text-dim)' }}>
        <span><span style={{ color: '#34A853' }}>✓</span> calendar connected</span>
        <span><span style={{ fontWeight: '700' }}>+</span> not connected yet: tap to add it</span>
        <span>⚠️ two sources claim one night</span>
        {hasHolds && (
          <span title="A guest with an agreed late check-out is still in the villa when the next family would arrive (likewise an early check-in the night before), so that night is not for sale: it is closed here, in enquiries and on every platform's calendar."
            style={{ color: HOLD_COLOR }}>
            <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '3px', border: `1px dashed ${HOLD_COLOR}`, background: 'rgba(245,158,11,0.3)', boxSizing: 'border-box', marginRight: '4px', verticalAlign: '-1px' }} />
            held night
          </span>
        )}
      </div>
    </div>
  )
}

export default function ChannelCalendar() {
  const navigate = useNavigate()
  const [feeds, setFeeds] = useState([])
  const [calItems, setCalItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ channel: '', label: '', icsUrl: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [f, c] = await Promise.all([
        api.getIcalFeeds(DEFAULT_VILLA_ID),
        api.getVillaCalendar(DEFAULT_VILLA_ID),
      ])
      setFeeds(Array.isArray(f) ? f : [])
      setCalItems(Array.isArray(c) ? c : [])
    } catch (e) { showToast('Failed to load: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  async function handleAdd() {
    if (!form.channel.trim()) { showToast('Channel required', 'error'); return }
    if (!/^https?:\/\//i.test(form.icsUrl.trim())) { showToast('A valid iCal URL is required', 'error'); return }
    setSaving(true)
    try {
      await api.addIcalFeed({
        villaId: DEFAULT_VILLA_ID,
        channel: form.channel.trim(),
        label: form.label.trim() || undefined,
        icsUrl: form.icsUrl.trim(),
      })
      showToast('✅ Feed added')
      setShowAdd(false)
      setForm({ channel: '', label: '', icsUrl: '' })
      load()
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleToggle(feedId) {
    try {
      await api.toggleIcalFeed({ feedId })
      setFeeds(fs => fs.map(f => f.feed_id === feedId ? { ...f, is_active: f.is_active ? 0 : 1 } : f))
    } catch (e) { showToast('Failed', 'error') }
  }

  async function handleDelete(feedId, label) {
    if (!window.confirm(`Remove the ${label} feed? Its synced blocks will be deleted too.`)) return
    try {
      await api.deleteIcalFeed({ feedId })
      showToast('Feed removed')
      load()
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
  }

  async function handleSyncNow({ quiet = false } = {}) {
    setSyncing(true)
    try {
      const res = await api.runIcalSyncNow({ villaId: DEFAULT_VILLA_ID })
      const failed = (res.results || []).filter(r => !r.ok)
      if (failed.length > 0) showToast(`Synced with ${failed.length} error(s) — see feed status below`, 'error')
      else if (!quiet) showToast(`✅ Synced ${res.feeds} feed${res.feeds !== 1 ? 's' : ''}`)
      load()
    } catch (e) { showToast('Sync failed: ' + e.message, 'error') }
    finally { setSyncing(false) }
  }

  // The scheduled sync runs only a few times a day at best, so what is on screen
  // can be hours old. Opening the screen refreshes any calendar that has not
  // been read for half an hour — once per visit, and silently unless it fails.
  const autoSynced = useRef(false)
  useEffect(() => {
    if (loading || autoSynced.current || feeds.length === 0) return
    autoSynced.current = true
    const stale = feeds.some(f => f.is_active && (!f.last_synced_at ||
      Date.now() - new Date(f.last_synced_at.replace(' ', 'T') + 'Z').getTime() > 30 * 60 * 1000))
    if (stale) handleSyncNow({ quiet: true })
  }, [loading, feeds])

  const INP = { width: '100%', padding: '9px 12px', borderRadius: '8px', boxSizing: 'border-box', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.9rem' }
  const LBL = { display: 'block', fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '4px' }

  // Nights per source in the month on show: the key's chips and the grid's summary read it.
  const tally = useMemo(() => monthNightsTally(calItems, monthCursor.getFullYear(), monthCursor.getMonth()), [calItems, monthCursor])

  // A platform in the key whose calendar is not connected yet: open "+ Feed" with it filled in.
  const addFormRef = useRef(null)
  function connectPartner(name) {
    setForm({ channel: name, label: '', icsUrl: '' })
    setShowAdd(true)
    setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Channel calendar</div>
          <div className="topbar-sub">SYNCED AVAILABILITY ACROSS OTAs</div>
        </div>
        <button onClick={() => setShowAdd(s => !s)}
          style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'var(--gold)', color: '#1A202C', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}>
          {showAdd ? '✕' : '+ Feed'}
        </button>
      </div>

      <div className="screen-body">
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '14px', lineHeight: 1.5 }}>
          Add each channel's iCal export URL (Airbnb calendar settings → "Export Calendar") to pull
          in blocked dates automatically. They refresh in the background, whenever a platform reads
          its link below, and when you open this screen or tap "Sync now". A ⚠️ outline on the
          calendar below means two different channels claim the same date — a real double-booking
          to resolve.
        </div>

        {showAdd && (
          <div ref={addFormRef} style={{ background: 'rgba(200,144,58,0.06)', border: '1px solid rgba(200,144,58,0.25)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ fontWeight: '700', color: 'var(--gold)', fontSize: '0.88rem', marginBottom: '12px' }}>New channel feed</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LBL}>CHANNEL *</label>
                <input value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                  placeholder="e.g. airbnb, booking.com" style={INP} />
              </div>
              <div>
                <label style={LBL}>LABEL (OPTIONAL)</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. GVR Villa listing" style={INP} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={LBL}>ICAL EXPORT URL *</label>
                <input value={form.icsUrl} onChange={e => setForm(f => ({ ...f, icsUrl: e.target.value }))}
                  placeholder="https://www.airbnb.com/calendar/ical/....ics?t=..." style={INP} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setShowAdd(false)}
                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving}
                style={{ flex: 2, padding: '9px', borderRadius: '9px', border: 'none', background: 'var(--gold)', color: '#1A202C', fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Adding…' : 'Add feed'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="card-section-label" style={{ margin: 0 }}>CONNECTED FEEDS</div>
          <button onClick={handleSyncNow} disabled={syncing || feeds.length === 0}
            style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(200,144,58,0.35)', background: 'rgba(200,144,58,0.1)', color: 'var(--gold)', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', opacity: syncing || feeds.length === 0 ? 0.5 : 1 }}>
            {syncing ? 'Syncing…' : '🔄 Sync now'}
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '24px', fontSize: '0.85rem' }}>Loading…</div>}

        {!loading && feeds.length === 0 && !showAdd && (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '0.85rem', border: '1px dashed rgba(200,144,58,0.2)', borderRadius: '12px', marginBottom: '14px' }}>
            No channel feeds yet.<br />
            <span style={{ fontSize: '0.75rem' }}>Tap "+ Feed" to connect Airbnb's calendar export URL.</span>
          </div>
        )}

        {feeds.map(f => (
          <div key={f.feed_id} style={{ background: 'var(--dark-card)', border: `1px solid ${f.is_active ? 'rgba(200,144,58,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: '12px', padding: '14px', marginBottom: '8px', opacity: f.is_active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ ...sourcePill(f.channel), fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>{channelLabel(f.channel)}</span>
                  {f.label && <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: '600' }}>{f.label}</span>}
                  {!f.is_active && <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '8px' }}>PAUSED</span>}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '5px' }}>
                  {f.last_sync_status === 'error'
                    ? <span style={{ color: '#EF4444' }}>⚠️ Last sync failed: {f.last_sync_error}</span>
                    : f.last_synced_at
                      ? `Last synced ${f.last_synced_at} · ${f.last_sync_count ?? 0} block(s)`
                      : 'Not synced yet'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => handleToggle(f.feed_id)}
                  style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer' }}>
                  {f.is_active ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => handleDelete(f.feed_id, channelLabel(f.channel))}
                  style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: '#EF4444', fontSize: '0.72rem', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}

        <CalendarExports feeds={feeds} showToast={showToast} />

        <div className="card-section-label" style={{ marginTop: '18px', marginBottom: '10px' }}>CALENDAR</div>

        {!loading && <SourceKey items={calItems} feeds={feeds} tally={tally} onConnect={connectPartner} />}

        {!loading && (
          <CalendarGrid
            items={calItems}
            tally={tally}
            monthCursor={monthCursor}
            onPrev={() => setMonthCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() - 1); return d })}
            onNext={() => setMonthCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() + 1); return d })}
            onToday={() => { const d = new Date(); d.setDate(1); setMonthCursor(d) }}
          />
        )}

        <div style={{ height: '20px' }} />
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

const styles = {
  navBtn: { width: '30px', height: '26px', borderRadius: '7px', border: '1px solid var(--border-dim)', background: 'var(--dark-card)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' },
  dayCell: { background: 'var(--dark-card)', border: '1px solid transparent', borderRadius: '5px', minHeight: '26px', padding: '3px 5px', fontSize: '0.68rem', color: 'var(--text-dim)' },
}
