import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CONFIG } from '../config'
import { useState, useEffect } from 'react'
import { api } from '../api'

// Two top-level sections: Hospitality (Villa + Rental) and Estates
const HOSPITALITY = {
  label: 'SERVICED VILLAS & PASSIVE RENTAL',
  color: '#C8903A',
  rows: [
    {
      id: 'villa', icon: '🏡', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Serviced Villas',
      sub: 'Multi-villa · Bookings · Check-in/out · Income · Dashboard',
      path: '/owner/villa',
    },
    {
      id: 'rental', icon: '🏢', bg: 'rgba(24,95,165,0.08)', arrow: '#185FA5',
      title: 'Passive rental income',
      sub: 'Monthly tracker · Dashboard · Renewal alerts',
      path: '/owner/rental',
    },
  ],
}
const PEOPLE = {
  label: 'PEOPLE & OPERATIONS',
  color: '#8B5CF6',
  rows: [
    {
      id: 'guests', icon: '👥', bg: 'rgba(139,92,246,0.08)', arrow: '#8B5CF6',
      title: 'Guest repository',
      sub: 'Contact list · Repeat guests',
      path: '/owner/guests',
    },
    {
      id: 'rdashboard', icon: '📊', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'R-Dashboard',
      sub: 'RamananKutty commission · Unpaid · History',
      path: '/owner/r-dashboard',
    },
  ],
}
const ESTATES = {
  label: 'ESTATES',
  color: '#3B6D11',
  rows: [
    {
      id: 'pollachi', icon: '🌴', bg: 'rgba(59,109,17,0.08)', arrow: '#3B6D11',
      title: 'Pollachi estate',
      sub: 'Coconut tracker · Dashboard · Income/Expense',
      path: '/owner/pollachi',
    },
    {
      id: 'pavutumuri', icon: '🌳', bg: 'rgba(15,110,86,0.08)', arrow: '#0F6E56',
      title: 'Pavutumuri estate',
      sub: 'Rubber tracker · Income/Expense',
      path: '/owner/pavutumuri',
    },
  ],
}

// ── SHEET ID for Registration Responses ──────────────────────────────────
const REG_SHEET_ID = '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0'

function MenuSection({ section }) {
  const navigate = useNavigate()
  return (
    <div>
      <div className="card-section-label" style={{ color: section.color }}>{section.label}</div>
      <div className="menu-tile">
        {section.rows.map((row, i) => (
          <div
            key={row.id}
            className="menu-row"
            onClick={() => navigate(row.path)}
            style={i < section.rows.length - 1 ? {} : { borderBottom: 'none' }}
          >
            <div className="menu-icon" style={{ background: row.bg }}>{row.icon}</div>
            <div className="menu-label">
              <div className="menu-title">{row.title}</div>
              <div className="menu-sub">{row.sub}</div>
            </div>
            <div className="menu-arrow" style={{ background: row.arrow }}>›</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PENDING REVIEW BLOCK ─────────────────────────────────────────────────
function PendingReviewBlock() {
  const [pending, setPending] = useState([])
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    api.getPendingReviewStays().then(data => {
      if (Array.isArray(data)) { setPending(data); if (data.length > 0) setSelected(data[0]) }
    }).catch(() => {})
  }, [])

  if (pending.length === 0) return null

  async function handleApprove() {
    if (!selected) return
    setSaving(true)
    try {
      await api.approvePendingBooking({ stayId: selected.stayId })
      showToast('✅ Approved — Raman can now check in ' + selected.guestName)
      const updated = pending.filter(p => p.stayId !== selected.stayId)
      setPending(updated)
      setSelected(updated[0] || null)
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally { setSaving(false) }
  }

  function fmt(d) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return d }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div className="card-section-label" style={{ color: '#F59E0B' }}>
        🔶 PENDING REVIEW ({pending.length})
      </div>
      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>
        {pending.map((p, i) => (
          <div key={p.stayId} onClick={() => setSelected(p)}
            style={{ padding: '12px 16px', cursor: 'pointer',
              borderBottom: i < pending.length - 1 ? '1px solid rgba(245,158,11,0.12)' : 'none',
              background: selected?.stayId === p.stayId ? 'rgba(245,158,11,0.1)' : 'transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>
                {selected?.stayId === p.stayId && <span style={{ color: '#F59E0B', marginRight: '6px' }}>✓</span>}
                {p.guestName}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                {fmt(p.checkIn)} · {p.nights || 1}N · {p.phone || p.email || ''}
              </div>
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px',
              borderRadius: '10px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
              Provisional
            </span>
          </div>
        ))}
      </div>
      {selected && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {selected.driveFolderUrl && (
            <a href={selected.driveFolderUrl} target="_blank" rel="noreferrer"
              style={{ flex: 1, padding: '11px', borderRadius: '10px', textAlign: 'center',
                border: '1px solid rgba(245,158,11,0.3)', background: 'transparent',
                color: '#F59E0B', fontSize: '0.8rem', textDecoration: 'none' }}>
              📁 View folder
            </a>
          )}
          <button onClick={handleApprove} disabled={saving}
            style={{ flex: 2, padding: '11px', borderRadius: '10px',
              border: '1px solid rgba(52,168,83,0.4)', background: 'rgba(52,168,83,0.12)',
              color: '#34A853', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
            {saving ? '…' : '✅ Onboard Guest'}
          </button>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── MANUAL TRIGGER BLOCK ─────────────────────────────────────────────────
// Reads last 5 rows from Registration Response sheet via Apps Script Web App
// Shows guests where Drive folder is missing — hidden when all folders exist
function ManualTriggerBlock() {
  const [rows, setRows] = useState(null)   // null = loading, [] = all done, [...] = pending
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => { loadSheetRows() }, [])

  async function loadSheetRows() {
    try {
      // Fetch last 5 rows from Registration sheet via public CSV export
      const url = `https://docs.google.com/spreadsheets/d/${REG_SHEET_ID}/gviz/tq?tqx=out:csv&range=A:Z`
      const res = await fetch(url)
      const text = await res.text()
      const lines = text.trim().split('\n')
      if (lines.length < 2) { setRows([]); return }

      const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim())
      const last5   = lines.slice(-5).map(l => parseCSVRow(l))

      function getCol(row, keyword) {
        const i = headers.findIndex(h => h.includes(keyword))
        return i >= 0 ? (row[i] || '').replace(/^"|"$/g, '').trim() : ''
      }

      const guests = last5.map((row, idx) => ({
        idx,
        name:     getCol(row, 'booker') || getCol(row, 'full name'),
        checkIn:  getCol(row, 'check in') || getCol(row, 'check-in'),
        checkOut: getCol(row, 'check out') || getCol(row, 'check-out'),
        email:    getCol(row, 'email'),
        phone:    getCol(row, 'phone'),
      })).filter(g => g.name)

      // For each guest, check if a stay with drive_folder_url already exists
      const withStatus = await Promise.all(guests.map(async g => {
        try {
          const res = await api.getPendingReviewStays()
          // Simple check — if name appears in pending or has a drive folder in D1
          // Use findOpenStay to check
          const found = await fetch(`/api/findOpenStay?guestName=${encodeURIComponent(g.name)}&checkInDate=${g.checkIn}`,
            { headers: { Authorization: `Bearer ${sessionStorage.getItem('ge_token')||''}` } })
          const data = await found.json()
          const hasFolderAlready = data?.data?.driveFolderUrl
          return { ...g, hasFolderAlready }
        } catch { return { ...g, hasFolderAlready: false } }
      }))

      const missing = withStatus.filter(g => !g.hasFolderAlready)
      setRows(missing)
      if (missing.length > 0) setSelected(missing[0])
    } catch (e) {
      console.warn('ManualTrigger load error:', e)
      setRows([])
    }
  }

  function parseCSVRow(line) {
    const result = []; let cur = ''; let inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { result.push(cur); cur = '' }
      else cur += ch
    }
    result.push(cur)
    return result
  }

  async function handleOnboard() {
    if (!selected) return
    setSaving(true)
    try {
      const result = await api.createProvisionalBooking({
        guestName:   selected.name,
        checkInDate: selected.checkIn,
        checkOutDate: selected.checkOut,
        guestEmail:  selected.email,
        guestPhone:  selected.phone,
        villaId:     'dwarka',
        source:      'manual_trigger',
      })
      showToast('✅ Onboarded — booking created for ' + selected.name)
      // Remove from list
      const updated = rows.filter(r => r.idx !== selected.idx)
      setRows(updated)
      setSelected(updated[0] || null)
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally { setSaving(false) }
  }

  // Hide entirely if loading or no missing guests
  if (rows === null) return null
  if (rows.length === 0) return null

  function fmt(d) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
    catch { return d }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div className="card-section-label" style={{ color: '#85B7EB' }}>
        📋 MANUAL ONBOARD — SHEET GUESTS
      </div>
      <div style={{ background: 'rgba(133,183,235,0.06)', border: '1px solid rgba(133,183,235,0.2)',
        borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>
        {rows.map((g, i) => (
          <div key={g.idx} onClick={() => setSelected(g)}
            style={{ padding: '12px 16px', cursor: 'pointer',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(133,183,235,0.1)' : 'none',
              background: selected?.idx === g.idx ? 'rgba(133,183,235,0.08)' : 'transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>
                {selected?.idx === g.idx && <span style={{ color: '#85B7EB', marginRight: '6px' }}>✓</span>}
                {g.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                {fmt(g.checkIn)} → {fmt(g.checkOut)} · {g.phone || g.email || ''}
              </div>
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px',
              borderRadius: '10px', background: 'rgba(133,183,235,0.15)', color: '#85B7EB' }}>
              No folder
            </span>
          </div>
        ))}
      </div>
      {selected && (
        <button onClick={handleOnboard} disabled={saving}
          style={{ width: '100%', padding: '12px', borderRadius: '10px',
            border: '1px solid rgba(133,183,235,0.4)', background: 'rgba(133,183,235,0.1)',
            color: '#85B7EB', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}>
          {saving ? '…' : '📋 Onboard Guest — ' + selected.name}
        </button>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}


// ── CHECKIN LINKS BLOCK ──────────────────────────────────────────────────
// Shows all check-in links with copy button and active/inactive toggle
function CheckinLinksBlock() {
  const [links,   setLinks]   = useState(null)
  const [copied,  setCopied]  = useState(null)
  const [toggling,setToggling]= useState(null)
  const BASE = window.location.origin

  useEffect(() => {
    api.getCheckinLinks().then(data => {
      if (Array.isArray(data)) setLinks(data)
    }).catch(() => setLinks([]))
  }, [])

  async function copyLink(lnk) {
    const url = `${BASE}/checkin/${lnk.token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(lnk.token)
      setTimeout(() => setCopied(null), 2000)
    } catch { }
  }

  async function toggleLink(lnk) {
    setToggling(lnk.token)
    try {
      await api.toggleCheckinLink({ token: lnk.token })
      setLinks(prev => prev.map(l =>
        l.token === lnk.token ? { ...l, is_active: l.is_active ? 0 : 1 } : l
      ))
    } finally { setToggling(null) }
  }

  if (!links) return null

  return (
    <div style={{ marginBottom:'16px' }}>
      <div className="card-section-label" style={{ color:'#8B5CF6' }}>
        🔗 CHECK-IN LINKS
      </div>
      <div style={{ background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.2)',
        borderRadius:'12px', overflow:'hidden' }}>
        {links.map((lnk, i) => (
          <div key={lnk.token} style={{ padding:'11px 14px',
            borderBottom: i < links.length-1 ? '1px solid rgba(139,92,246,0.1)' : 'none',
            display:'flex', alignItems:'center', gap:'10px',
            opacity: lnk.is_active ? 1 : 0.45 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'0.82rem', fontWeight:'600', color: lnk.is_active ? '#D0D0D0' : '#6B7280' }}>
                {lnk.label || lnk.partner}
              </div>
              <div style={{ fontSize:'0.68rem', color:'#5C7080', marginTop:'2px',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                /checkin/{lnk.token}
                {lnk.use_count > 0 && <span style={{ marginLeft:'8px', color:'#8B5CF6' }}>
                  · {lnk.use_count} open{lnk.use_count !== 1 ? 's' : ''}
                </span>}
              </div>
            </div>
            {/* Copy */}
            <button onClick={() => copyLink(lnk)}
              style={{ padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(139,92,246,0.3)',
                background: copied===lnk.token ? 'rgba(52,168,83,0.15)' : 'rgba(139,92,246,0.1)',
                color: copied===lnk.token ? '#34A853' : '#8B5CF6',
                fontSize:'0.72rem', cursor:'pointer', whiteSpace:'nowrap', fontWeight:'600' }}>
              {copied===lnk.token ? '✅ Copied' : '📋 Copy'}
            </button>
            {/* Toggle */}
            <button onClick={() => toggleLink(lnk)} disabled={toggling===lnk.token}
              style={{ padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.08)',
                background:'transparent', color: lnk.is_active ? '#EF4444' : '#34A853',
                fontSize:'0.72rem', cursor:'pointer', whiteSpace:'nowrap' }}>
              {toggling===lnk.token ? '…' : lnk.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}


// ── NEEDS ATTENTION BLOCK ────────────────────────────────────────────────
// ── REVIEW CHASE BLOCK ───────────────────────────────────────────────────
// Stays past checkout with no review yet
// - WhatsApp nudge button per guest
// - Manual star rating + close
// - Auto-close button when 20+ days without review
function ReviewChaseBlock() {
  const [items, setItems]       = useState([])
  const [expanded, setExpanded] = useState({})
  const [saving, setSaving]     = useState({})
  const [ratings, setRatings]   = useState({})
  const [toast, setToast]       = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4500)
  }

  const load = () => {
    api.getReviewChaseList().then(data => {
      if (Array.isArray(data)) setItems(data)
    }).catch(() => {})
  }

  useEffect(() => { load() }, [])

  if (items.length === 0) return null

  function fmtDate(d) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
    catch { return d }
  }

  function waLink(phone, guestName) {
    const clean = (phone || '').replace(/\D/g, '')
    const num   = clean.startsWith('91') ? clean : `91${clean}`
    const msg   = encodeURIComponent(
      `Hi ${(guestName || '').split(' ')[0]}, thank you for staying with us at Luxury Villas of Guruvayur! 🙏 We hope you had a wonderful experience. If you have a moment, we'd really appreciate a review on Airbnb — it means a lot to us and helps future guests. Thank you!`
    )
    return `https://wa.me/${num}?text=${msg}`
  }

  const autoCloseable = items.filter(i => i.autoCloseReady)

  async function handleChased(stayId) {
    setSaving(p => ({ ...p, [stayId + '_wa']: true }))
    try {
      await api.markReviewChased({ stayId })
      showToast('✅ WhatsApp logged — chase recorded')
      load()
    } catch { showToast('Failed to log chase', 'error') }
    finally { setSaving(p => ({ ...p, [stayId + '_wa']: false })) }
  }

  async function handleClose(stayId, rating, reason) {
    setSaving(p => ({ ...p, [stayId + '_close']: true }))
    try {
      await api.closeStayWithReview({ stayId, rating: rating || 0, closedReason: reason || 'manual' })
      showToast(rating ? `✅ Closed with ${rating}★` : '✅ Closed — no review')
      setExpanded(p => ({ ...p, [stayId]: false }))
      load()
    } catch { showToast('Failed to close stay', 'error') }
    finally { setSaving(p => ({ ...p, [stayId + '_close']: false })) }
  }

  async function handleAutoCloseAll() {
    for (const item of autoCloseable) {
      await handleClose(item.stayId, 0, 'no_review')
    }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '8px' }}>
        <div className="card-section-label" style={{ color: '#F59E0B', marginBottom: 0 }}>
          ⭐ REVIEW CHASE ({items.length})
        </div>
        {autoCloseable.length > 0 && (
          <button onClick={handleAutoCloseAll}
            style={{ fontSize: '0.68rem', padding: '4px 10px', borderRadius: '8px',
              border: '1px solid rgba(92,112,128,0.3)', background: 'transparent',
              color: 'var(--text-dim)', cursor: 'pointer' }}>
            Auto-close {autoCloseable.length} old →
          </button>
        )}
      </div>

      <div style={{ background: 'var(--dark-card)', border: '1px solid var(--border-dim)',
        borderRadius: '12px', overflow: 'hidden' }}>
        {items.map((item, i) => {
          const isOpen    = expanded[item.stayId]
          const starRating = ratings[item.stayId] || 0

          return (
            <div key={item.stayId}
              style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border-dim)' : 'none' }}>

              {/* Row */}
              <div onClick={() => setExpanded(p => ({ ...p, [item.stayId]: !p[item.stayId] }))}
                style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem' }}>
                  {item.source?.toLowerCase().includes('airbnb') ? '🏡' : '🏠'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#F0F0F0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.guestName}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    Out {fmtDate(item.checkOut)} · {item.daysOut}d ago
                    {item.chaseCount > 0 && (
                      <span style={{ marginLeft: '6px', color: '#F59E0B' }}>
                        · chased {item.chaseCount}×
                        {item.daysSinceChase !== null && ` (${item.daysSinceChase}d ago)`}
                      </span>
                    )}
                  </div>
                </div>
                {item.autoCloseReady && (
                  <span style={{ fontSize: '0.62rem', fontWeight: '700', padding: '2px 7px',
                    borderRadius: '8px', background: 'rgba(92,112,128,0.2)', color: 'var(--text-dim)',
                    flexShrink: 0 }}>
                    20d+
                  </span>
                )}
                <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                  {isOpen ? '∨' : '›'}
                </span>
              </div>

              {/* Expanded actions */}
              {isOpen && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>

                  {/* WhatsApp nudge */}
                  {item.phone && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <a href={waLink(item.phone, item.guestName)} target="_blank" rel="noreferrer"
                        onClick={() => handleChased(item.stayId)}
                        style={{ flex: 1, padding: '10px', borderRadius: '10px', textAlign: 'center',
                          background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)',
                          color: '#25D366', fontSize: '0.82rem', fontWeight: '700',
                          textDecoration: 'none', display: 'block' }}>
                        💬 Send WhatsApp review request
                      </a>
                    </div>
                  )}

                  {/* Manual star rating */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)',
                      letterSpacing: '0.8px', marginBottom: '8px' }}>
                      CLOSE WITH RATING
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setRatings(p => ({ ...p, [item.stayId]: n }))}
                          style={{ flex: 1, padding: '10px 4px', borderRadius: '8px',
                            border: `1px solid ${starRating >= n ? 'rgba(200,144,58,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            background: starRating >= n ? 'rgba(200,144,58,0.15)' : 'transparent',
                            color: starRating >= n ? 'var(--gold)' : 'var(--text-dim)',
                            fontSize: '1rem', cursor: 'pointer', transition: 'all 0.1s' }}>
                          ★
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleClose(item.stayId, starRating, 'manual')}
                        disabled={saving[item.stayId + '_close'] || starRating === 0}
                        style={{ flex: 2, padding: '10px', borderRadius: '9px',
                          border: '1px solid rgba(52,168,83,0.4)',
                          background: starRating > 0 ? 'rgba(52,168,83,0.12)' : 'transparent',
                          color: starRating > 0 ? '#34A853' : 'var(--text-dim)',
                          fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
                          opacity: starRating === 0 ? 0.4 : 1 }}>
                        {saving[item.stayId + '_close'] ? '…' : `✅ Close ${starRating ? `with ${starRating}★` : '(select stars)'}`}
                      </button>
                      <button onClick={() => handleClose(item.stayId, 0, 'no_review')}
                        disabled={saving[item.stayId + '_close']}
                        style={{ flex: 1, padding: '10px', borderRadius: '9px',
                          border: '1px solid rgba(92,112,128,0.25)', background: 'transparent',
                          color: 'var(--text-dim)', fontSize: '0.78rem', cursor: 'pointer' }}>
                        No review
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

function NeedsAttentionBlock() {
  const [items, setItems] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.getPendingReviewStays().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setItems(data)
      }
    }).catch(() => {})
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{ marginBottom:'16px', background:'rgba(239,68,68,0.06)',
      border:'1px solid rgba(239,68,68,0.25)', borderRadius:'12px', overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(239,68,68,0.15)',
        display:'flex', alignItems:'center', gap:'8px' }}>
        <span>🚨</span>
        <span style={{ fontSize:'0.68rem', fontWeight:'700', color:'#EF4444', letterSpacing:'1.5px' }}>
          NEEDS ATTENTION
        </span>
        <span style={{ marginLeft:'auto', background:'rgba(239,68,68,0.2)', color:'#EF4444',
          fontSize:'0.65rem', fontWeight:'700', padding:'2px 8px', borderRadius:'10px' }}>
          {items.length}
        </span>
      </div>
      {items.map((item, i) => (
        <div key={i} onClick={() => navigate('/owner/villa')}
          style={{ padding:'11px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px',
            borderBottom: i < items.length-1 ? '1px solid rgba(239,68,68,0.1)' : 'none' }}>
          <span style={{ fontSize:'1.1rem' }}>🔶</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.85rem', fontWeight:'600', color:'#F0F0F0' }}>{item.guestName}</div>
            <div style={{ fontSize:'0.72rem', color:'#9AA5B4', marginTop:'2px' }}>
              Check-in: {item.checkIn} · Pending your review
            </div>
          </div>
          <span style={{ color:'#EF4444' }}>›</span>
        </div>
      ))}
    </div>
  )
}


// ── DUPLICATE BOOKINGS BLOCK ─────────────────────────────────────────────
// Shows last 2 months of double-booking attempts grouped by channel
// Ideal: 0 entries. Any entries = channel calendar sync issue.
function DuplicateBookingsBlock() {
  const [data, setData] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    api.getDuplicateBookings({ months: 2 }).then(d => {
      if (d && d.total !== undefined) setData(d)
    }).catch(() => {})
  }, [])

  if (!data || data.total === 0) return (
    <div style={{ marginBottom:'16px', background:'rgba(52,168,83,0.06)',
      border:'1px solid rgba(52,168,83,0.2)', borderRadius:'12px',
      padding:'12px 14px', display:'flex', alignItems:'center', gap:'10px' }}>
      <span>✅</span>
      <span style={{ fontSize:'0.8rem', color:'#34A853' }}>
        No duplicate bookings in the last 2 months — calendar sync is healthy
      </span>
    </div>
  )

  return (
    <div style={{ marginBottom:'16px', background:'rgba(239,68,68,0.06)',
      border:'1px solid rgba(239,68,68,0.25)', borderRadius:'12px', overflow:'hidden' }}>
      <div onClick={() => setExpanded(!expanded)}
        style={{ padding:'10px 14px', cursor:'pointer',
          display:'flex', alignItems:'center', gap:'8px' }}>
        <span>⚠️</span>
        <span style={{ fontSize:'0.68rem', fontWeight:'700', color:'#EF4444', letterSpacing:'1.5px' }}>
          DUPLICATE BOOKINGS — LAST 2 MONTHS
        </span>
        <span style={{ marginLeft:'auto', background:'rgba(239,68,68,0.2)', color:'#EF4444',
          fontSize:'0.65rem', fontWeight:'700', padding:'2px 8px', borderRadius:'10px' }}>
          {data.total}
        </span>
        <span style={{ color:'#EF4444', fontSize:'0.8rem' }}>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div style={{ padding:'0 14px 14px' }}>
          <div style={{ fontSize:'0.72rem', color:'#9AA5B4', marginBottom:'10px' }}>
            These channels had booking conflicts — calendar may not be syncing:
          </div>
          {data.byChannel.map((ch, i) => (
            <div key={i} style={{ marginBottom:'8px', padding:'10px 12px',
              background:'rgba(239,68,68,0.04)', borderRadius:'8px',
              border:'1px solid rgba(239,68,68,0.1)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <span style={{ fontSize:'0.82rem', fontWeight:'700', color:'#F0F0F0',
                  textTransform:'capitalize' }}>{ch.channel}</span>
                <span style={{ fontSize:'0.75rem', color:'#EF4444', fontWeight:'600' }}>
                  {ch.count} incident{ch.count > 1 ? 's' : ''}
                </span>
              </div>
              {ch.incidents.map((inc, j) => (
                <div key={j} style={{ fontSize:'0.7rem', color:'#6B7280',
                  borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'4px', marginTop:'4px' }}>
                  <div>{inc.detectedAt?.slice(0,10)} — {inc.newGuest} tried to book {inc.newDates}</div>
                  <div style={{ color:'#4B5563' }}>
                    Conflicted with: {inc.existingGuest} ({inc.existingDates}) — {inc.overlapNights} night overlap
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OwnerHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="screen">
      <div style={styles.header}>
        <img src="/icons/logo-black.png" alt="GE" style={styles.logo}
          onError={e => e.target.style.display = 'none'} />
        <div style={styles.headerText}>
          <div style={styles.brandName}>{CONFIG.brandName}</div>
          <div style={styles.tagline}>{CONFIG.tagline.toUpperCase()}</div>
        </div>
        <div style={styles.welcomeBadge}>
          <span style={styles.welcomeLabel}>OWNER</span>
        </div>
      </div>

      <div className="screen-body">
        {/* Needs Attention — urgent items at top of page */}
        <NeedsAttentionBlock />

        {/* Duplicate Bookings — channel sync health check */}
        <DuplicateBookingsBlock />

        {/* Pending Review — provisional bookings awaiting approval */}
        <PendingReviewBlock />

        {/* Review Chase — past-checkout stays with no review yet */}
        <ReviewChaseBlock />

        {/* Manual Trigger — only visible when sheet guests have no folder */}
        <ManualTriggerBlock />

        {/* Check-in Links — always visible for owner */}
        <CheckinLinksBlock />

        <MenuSection section={HOSPITALITY} />
        <MenuSection section={PEOPLE} />
        <MenuSection section={ESTATES} />

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button className="logout-btn" style={{ flex: 1 }} onClick={logout}>Log out</button>
          <button onClick={() => navigate('/infra/d1')} style={{padding:'12px 16px',borderRadius:'12px',border:'1px solid rgba(24,95,165,0.3)',background:'rgba(24,95,165,0.08)',color:'#85B7EB',fontSize:'0.8rem',cursor:'pointer'}}>🗄</button>
          <button onClick={() => navigate('/debug')}
            style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.8rem', cursor: 'pointer' }}>🔧</button>
          <button onClick={() => navigate('/test')}
            style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(52,168,83,0.3)', background: 'rgba(52,168,83,0.08)', color: 'var(--green)', fontSize: '0.8rem', cursor: 'pointer' }}>🧪</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  header: { background: '#111111', padding: '16px 16px 14px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(200,144,58,0.18)' },
  logo:   { height: '52px', width: '52px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(200,144,58,0.3)', boxShadow: '0 4px 12px rgba(200,144,58,0.15)' },
  headerText: { flex: 1 },
  brandName:  { fontFamily: "\'Cormorant Garamond\', serif", fontSize: '1.15rem', fontWeight: '600', color: '#E8B86D', letterSpacing: '0.5px' },
  tagline:    { fontSize: '0.6rem', color: '#5C7080', letterSpacing: '2px', marginTop: '2px' },
  welcomeBadge: { background: 'rgba(200,144,58,0.12)', border: '1px solid rgba(200,144,58,0.2)', borderRadius: '20px', padding: '4px 12px' },
  welcomeLabel: { color: '#C8903A', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '2px' },
}
