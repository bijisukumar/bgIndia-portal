// ============================================================
//  ChannelCalendar.jsx
//  Owner-facing management for OTA iCal sync (Airbnb today; Booking.com,
//  Agoda etc. are just more feed rows — same sync code, no new code needed).
//  Route: /owner/villa/channel-calendar
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import { channelLabel, channelPillStyle } from '../../utils/channel'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChannelCalendar() {
  const navigate = useNavigate()
  const [feeds, setFeeds] = useState([])
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ channel: '', label: '', icsUrl: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [f, b] = await Promise.all([
        api.getIcalFeeds(DEFAULT_VILLA_ID),
        api.getIcalBlocks(DEFAULT_VILLA_ID),
      ])
      setFeeds(Array.isArray(f) ? f : [])
      setBlocks(Array.isArray(b) ? b : [])
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

  const upcomingBlocks = blocks.filter(b => b.checkout_date >= new Date().toISOString().slice(0, 10))

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
          an immediate refresh. A block with no matching booking in the system may just be a manual
          block you set directly on the channel — a ⚠️ conflict means it overlaps a confirmed booking
          from a different channel.
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

        <div className="card-section-label" style={{ marginTop: '18px' }}>UPCOMING BLOCKED DATES</div>

        {!loading && upcomingBlocks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            No upcoming blocks synced yet.
          </div>
        )}

        {upcomingBlocks.map(b => (
          <div key={b.block_id} style={{ background: 'var(--dark-card)', border: `1px solid ${b.conflict ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ ...channelPillStyle(b.channel), fontSize: '0.62rem', fontWeight: '700', padding: '2px 7px', borderRadius: '9px' }}>{channelLabel(b.channel)}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: '600' }}>{fmtDate(b.checkin_date)} → {fmtDate(b.checkout_date)}</span>
                {b.conflict && <span style={{ fontSize: '0.62rem', color: '#EF4444', background: 'rgba(239,68,68,0.12)', padding: '1px 7px', borderRadius: '8px', fontWeight: '700' }}>⚠️ CONFLICT</span>}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '3px' }}>
                {b.matchingStay
                  ? `Matches booking: ${b.matchingStay.guestName} (${channelLabel(b.matchingStay.source)})`
                  : (b.summary || 'No matching booking in the system yet')}
              </div>
            </div>
          </div>
        ))}

        <div style={{ height: '20px' }} />
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
