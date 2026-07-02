import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { CONFIG } from '../config'
import TopBar from '../components/TopBar'
import { parseLocalDate } from '../utils/dates'

// ── helpers ────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return String(d) }
}

function sourceIcon(source) {
  if (!source) return '🏠'
  const s = source.toLowerCase()
  if (s.includes('airbnb'))  return '🏡'
  if (s.includes('mmt') || s.includes('makemytrip')) return '✈️'
  if (s.includes('booking')) return '🌐'
  if (s.includes('goibibo')) return '🟣'
  return '🏠'
}

// ── OVERDUE STAYS BLOCK ────────────────────────────────────────────────────
// Guests whose checkout date has passed but stay is still open
function OverdueBlock({ overdue }) {
  const navigate = useNavigate()
  if (!overdue || overdue.length === 0) return null

  return (
    <div style={{ marginBottom: '14px', background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(239,68,68,0.15)',
        display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🚨</span>
        <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#EF4444', letterSpacing: '1.5px' }}>
          OVERDUE — STILL OPEN
        </span>
        <span style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.2)', color: '#EF4444',
          fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
          {overdue.length}
        </span>
      </div>

      {/* Rows */}
      {overdue.map((s, i) => (
        <div key={s.stayId || i}
          onClick={() => navigate('/raman/checkin')}
          style={{ padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
            borderBottom: i < overdue.length - 1 ? '1px solid rgba(239,68,68,0.1)' : 'none' }}>
          <span style={{ fontSize: '1.1rem' }}>{sourceIcon(s.source)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#F0F0F0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.guestName}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#EF9A9A', marginTop: '2px' }}>
              Checked out {fmtDate(s.checkOutDate)} ·{' '}
              <span style={{ fontWeight: '700' }}>
                {s.daysOver === 0 ? 'today' : `${s.daysOver} day${s.daysOver > 1 ? 's' : ''} ago`}
              </span>
              {' · '}{s.nights} night{s.nights > 1 ? 's' : ''}
            </div>
          </div>
          <span style={{ color: '#EF4444', fontSize: '1.1rem' }}>›</span>
        </div>
      ))}

      <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(239,68,68,0.1)' }}>
        <div style={{ fontSize: '0.7rem', color: 'rgba(239,68,68,0.7)' }}>
          Please close these stays so the owner can settle commissions
        </div>
      </div>
    </div>
  )
}

// ── UPCOMING CHECK-INS BLOCK ───────────────────────────────────────────────
// Guests arriving in next 7 days — Raman can prepare
function UpcomingBlock({ upcoming }) {
  const navigate = useNavigate()
  if (!upcoming || upcoming.length === 0) return null

  const today = upcoming.filter(s => s.daysUntil <= 1)
  const soon  = upcoming.filter(s => s.daysUntil > 1)

  return (
    <div style={{ marginBottom: '14px', background: 'rgba(52,168,83,0.05)',
      border: '1px solid rgba(52,168,83,0.25)', borderRadius: '12px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(52,168,83,0.12)',
        display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📋</span>
        <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#34A853', letterSpacing: '1.5px' }}>
          UPCOMING CHECK-INS · NEXT 7 DAYS
        </span>
        <span style={{ marginLeft: 'auto', background: 'rgba(52,168,83,0.15)', color: '#34A853',
          fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
          {upcoming.length}
        </span>
      </div>

      {/* Today / tomorrow first */}
      {today.map((s, i) => (
        <div key={s.stayId || i}
          onClick={() => navigate('/raman/checkin')}
          style={{ padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(52,168,83,0.07)',
            borderBottom: '1px solid rgba(52,168,83,0.1)' }}>
          <span style={{ fontSize: '1.1rem' }}>{sourceIcon(s.source)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#F0F0F0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.guestName}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#34A853', marginTop: '2px', fontWeight: '700' }}>
              TODAY · {s.adults} guest{s.adults > 1 ? 's' : ''} · {s.nights} night{s.nights > 1 ? 's' : ''}
            </div>
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#34A853',
            background: 'rgba(52,168,83,0.2)', padding: '3px 8px', borderRadius: '8px' }}>
            TODAY
          </span>
        </div>
      ))}

      {/* Rest of upcoming */}
      {soon.map((s, i) => (
        <div key={s.stayId || i}
          onClick={() => navigate('/raman/checkin')}
          style={{ padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
            borderBottom: i < soon.length - 1 ? '1px solid rgba(52,168,83,0.08)' : 'none' }}>
          <span style={{ fontSize: '1.1rem' }}>{sourceIcon(s.source)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#F0F0F0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.guestName}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9AA5B4', marginTop: '2px' }}>
              {fmtDate(s.checkInDate)} · {s.adults} guest{s.adults > 1 ? 's' : ''} · {s.nights} night{s.nights > 1 ? 's' : ''}
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#9AA5B4', flexShrink: 0 }}>
            in {s.daysUntil} days
          </span>
        </div>
      ))}
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function RamanHome() {
  const navigate = useNavigate()
  const [activeStay,  setActiveStay]  = useState(null)
  const [readyCount,  setReadyCount]  = useState(0)
  const [todo,        setTodo]        = useState({ overdue: [], upcoming: [] })
  const [loadingStay, setLoadingStay] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getActiveStay('dwarka'),
      api.getPendingCheckIns(),
      api.getRamanTodo('dwarka'),
    ]).then(([stay, pending, todoData]) => {
      setActiveStay(stay || null)
      setReadyCount(Array.isArray(pending) ? pending.length : 0)
      setTodo({
        overdue:  todoData?.overdue  || [],
        upcoming: todoData?.upcoming || [],
      })
      setLoadingStay(false)
    }).catch(() => setLoadingStay(false))
  }, [])

  // Defensive helpers — API may return snake_case or camelCase
  const guestName   = activeStay ? (activeStay.guestName   || activeStay.guest_name   || 'Guest') : null
  const checkInDate = activeStay ? (activeStay.checkInDate  || activeStay.checkin_date  || '')     : null
  const adultCount  = activeStay ? (activeStay.guestCount   || activeStay.adults        || '')     : null

  const activeLabel = activeStay
    ? `Linked to ${guestName}`
    : readyCount > 0
      ? `${readyCount} guest${readyCount > 1 ? 's' : ''} ready — complete check-in first`
      : 'Unlocks after guest checks in'

  const MENU = [
    {
      icon: '🏠', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Check-in',
      sub: readyCount > 0
        ? `${readyCount} guest${readyCount > 1 ? 's' : ''} ready for check-in`
        : activeStay
          ? `Active: ${guestName}`
          : 'No guests ready yet',
      path: '/raman/checkin',
      disabled: false,
      badge: readyCount > 0 ? readyCount : null,
    },
    {
      icon: '🛒', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Kitchen incidentals',
      sub: activeStay ? activeLabel : 'Log for active stay or a recent checkout',
      path: '/raman/kitchen',
      disabled: false,
    },
    {
      icon: '🍳', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Breakfast',
      sub: activeStay
        ? `${adultCount} guests · ₹${CONFIG.breakfastRate}/person`
        : 'Log for active stay or a recent checkout',
      path: '/raman/breakfast',
      disabled: false,
    },
    {
      icon: '🚗', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Car rental',
      sub: activeStay ? `Linked to ${guestName}` : 'Log for active stay or a recent checkout',
      path: '/raman/carrental',
      disabled: false,
    },
    {
      icon: '🧾', bg: 'rgba(239,68,68,0.08)', arrow: '#EF4444',
      title: 'Villa expenses',
      sub: 'Log electricity, maintenance, repairs & recurring costs',
      path: '/raman/expenses',
      disabled: false,
    },
    {
      icon: '📦', bg: 'rgba(15,110,86,0.08)', arrow: '#0F6E56',
      title: 'Inventory',
      sub: 'Stock levels · restock after a purchase',
      path: '/raman/inventory',
      disabled: false,
    },
    {
      icon: '💰', bg: 'rgba(52,168,83,0.08)', arrow: '#34A853',
      title: 'My earnings',
      sub: 'Commission snapshot · paid & outstanding',
      path: '/raman/dashboard',
      disabled: false,
    },
  ]

  return (
    <div className="screen">
      <TopBar title={CONFIG.villaName || 'Guruvayur Estates'} sub="RAMAN · VILLA MANAGER" />

      <div className="screen-body">

        {/* ── TO-DO BLOCKS ── */}
        {loadingStay ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 0', marginBottom: '8px' }}>
            <div className="spinner"/>
            <span style={{ color: '#5C7080', fontSize: '0.85rem' }}>Loading…</span>
          </div>
        ) : (
          <>
            <OverdueBlock  overdue={todo.overdue} />
            <UpcomingBlock upcoming={todo.upcoming} />
          </>
        )}

        {/* ── ACTIVE STAY BANNER ── */}
        {!loadingStay && (
          activeStay ? (
            <div className="active-stay-banner" onClick={() => navigate('/raman/checkin')}>
              <div className="active-stay-icon">🏠</div>
              <div style={{ flex: 1 }}>
                <div className="active-stay-name">Active: {guestName}</div>
                <div className="active-stay-sub">
                  Check-in {checkInDate} · {adultCount} guests
                </div>
              </div>
              <span style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>›</span>
            </div>
          ) : readyCount > 0 ? (
            <div className="active-stay-banner"
              style={{ borderColor: 'rgba(52,168,83,0.4)', background: 'rgba(52,168,83,0.06)' }}
              onClick={() => navigate('/raman/checkin')}>
              <div style={{ fontSize: '1.3rem' }}>🔑</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#34A853', fontWeight: '700', fontSize: '0.9rem' }}>
                  {readyCount} guest{readyCount > 1 ? 's' : ''} ready for check-in
                </div>
                <div className="active-stay-sub">Tap to open Check-in screen</div>
              </div>
              <span style={{ color: '#34A853', fontSize: '1.1rem' }}>›</span>
            </div>
          ) : todo.overdue.length === 0 && todo.upcoming.length === 0 ? (
            <div style={{ background: 'rgba(92,112,128,0.08)', border: '1px solid rgba(92,112,128,0.2)',
              borderRadius: '12px', padding: '12px 16px', marginBottom: '14px',
              display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '1.3rem' }}>🏠</div>
              <div>
                <div style={{ color: '#C8903A', fontSize: '0.85rem', fontWeight: '600' }}>
                  No active stay
                </div>
                <div style={{ color: '#5C7080', fontSize: '0.75rem', marginTop: '2px' }}>
                  Owner marks guests "Ready for Check-in" — they appear here
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* ── MENU ── */}
        <div className="card-section-label">GVR DWARKA VILLA</div>
        <div className="menu-tile">
          {MENU.map((item, i) => (
            <div key={i}
              className={`menu-row ${item.disabled ? 'menu-row-disabled' : ''}`}
              style={{
                borderBottom: i < MENU.length - 1 ? '1px solid var(--border-dim)' : 'none',
                opacity: item.disabled ? 0.55 : 1,
              }}
              onClick={() => {
                if (item.disabled) return
                navigate(item.path)
              }}>
              <div className="menu-icon" style={{ background: item.bg }}>{item.icon}</div>
              <div className="menu-label" style={{ flex: 1 }}>
                <div className="menu-title">{item.title}</div>
                <div className="menu-sub">{item.sub}</div>
                {item.disabled && item.lockReason && (
                  <div style={{ fontSize: '0.68rem', color: '#5C7080', marginTop: '2px' }}>
                    🔒 {item.lockReason}
                  </div>
                )}
              </div>
              {item.badge ? (
                <div style={{ background: '#34A853', color: '#fff', borderRadius: '12px',
                  padding: '2px 8px', fontSize: '0.75rem', fontWeight: '700',
                  minWidth: '20px', textAlign: 'center' }}>
                  {item.badge}
                </div>
              ) : item.disabled ? (
                <span style={{ fontSize: '1rem' }}>🔒</span>
              ) : (
                <div className="menu-arrow" style={{ background: item.arrow }}>›</div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
