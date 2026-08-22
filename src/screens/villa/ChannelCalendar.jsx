// ============================================================
//  ChannelCalendar.jsx
//  Owner-facing management for OTA iCal sync (Airbnb today; Booking.com,
//  Agoda etc. are just more feed rows — same sync code, no new code needed)
//  plus a merged month calendar showing every channel's booked/blocked
//  dates in one place.
//  Route: /owner/villa/channel-calendar
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import { channelLabel, channelPillStyle } from '../../utils/channel'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Fixed colors for known channels so they read consistently at a glance;
// any future channel (added purely by pasting a new feed URL, no code
// change) gets a stable color hashed from its name instead of grey.
const CHANNEL_COLORS = {
  direct: '#34A853', website: '#34A853',
  airbnb: '#FF5A5F',
  'booking.com': '#003B95', bookingcom: '#003B95', booking: '#003B95', booking_com: '#003B95',
  expedia: '#FBC02D',
  vrbo: '#3D67B1',
  makemytrip: '#E74C3C', mmt: '#E74C3C',
  agoda: '#5A2D8C',
  goibibo: '#D6006C',
  cleartrip: '#00A19C',
}
const FALLBACK_PALETTE = ['#8B5CF6', '#0EA5E9', '#F97316', '#14B8A6', '#EC4899']
function channelColor(source) {
  const s = (source || '').trim().toLowerCase()
  if (CHANNEL_COLORS[s]) return CHANNEL_COLORS[s]
  let hash = 0
  for (const ch of s) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]
}

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

function CalendarGrid({ items, monthCursor, onPrev, onNext, onToday }) {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month])
  const todayISO = toISO(new Date())

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onPrev} style={styles.navBtn}>‹</button>
          <button onClick={onToday} style={{ ...styles.navBtn, width: 'auto', padding: '0 10px', fontSize: '0.68rem' }}>Today</button>
          <button onClick={onNext} style={styles.navBtn}>›</button>
        </div>
        <div style={{ fontWeight: '700', color: 'var(--gold)', fontSize: '0.95rem' }}>{MONTH_NAMES[month]} {year}</div>
        <div style={{ width: '86px' }} />
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
                  const color = channelColor(seg.item.source)
                  return (
                    <div key={si} title={`${channelLabel(seg.item.source)}${seg.item.label ? ' · ' + seg.item.label : ''}`}
                      style={{
                        gridColumn: `${seg.startCol} / ${seg.endCol}`,
                        background: color,
                        color: '#fff',
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
                      {seg.item.conflict && '⚠️ '}{channelLabel(seg.item.source)}{seg.item.label ? ` · ${seg.item.label}` : ''}
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

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const res = await api.runIcalSyncNow({ villaId: DEFAULT_VILLA_ID })
      const failed = (res.results || []).filter(r => !r.ok)
      if (failed.length > 0) showToast(`Synced with ${failed.length} error(s) — see feed status below`, 'error')
      else showToast(`✅ Synced ${res.feeds} feed${res.feeds !== 1 ? 's' : ''}`)
      load()
    } catch (e) { showToast('Sync failed: ' + e.message, 'error') }
    finally { setSyncing(false) }
  }

  const INP = { width: '100%', padding: '9px 12px', borderRadius: '8px', boxSizing: 'border-box', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.9rem' }
  const LBL = { display: 'block', fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '4px' }

  const activeChannels = useMemo(() => {
    const set = new Map()
    for (const it of calItems) set.set((it.source || '').toLowerCase(), it.source)
    return [...set.values()]
  }, [calItems])

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
          in blocked dates automatically. A background sync runs periodically; use "Sync now" for
          an immediate refresh. A ⚠️ outline on the calendar below means two different channels
          claim the same date — a real double-booking to resolve.
        </div>

        {showAdd && (
          <div style={{ background: 'rgba(200,144,58,0.06)', border: '1px solid rgba(200,144,58,0.25)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
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
                  <span style={{ ...channelPillStyle(f.channel), fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>{channelLabel(f.channel)}</span>
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

        <div className="card-section-label" style={{ marginTop: '18px', marginBottom: '10px' }}>CALENDAR</div>

        {activeChannels.length > 0 && (
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {activeChannels.map(src => {
              const feed = feeds.find(f => (f.channel || '').toLowerCase() === (src || '').toLowerCase())
              return (
                <div key={src} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: channelColor(src), display: 'inline-block' }} />
                  {channelLabel(src)}
                  {feed && (
                    feed.last_sync_status === 'error'
                      ? <span style={{ color: '#EF4444' }}> · sync failed</span>
                      : feed.last_synced_at
                        ? <span> · synced {feed.last_synced_at.slice(0, 16)}</span>
                        : <span> · not synced yet</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && (
          <CalendarGrid
            items={calItems}
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
