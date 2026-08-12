import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { CONFIG } from '../config'
import TopBar from '../components/TopBar'
import { parseLocalDate } from '../utils/dates'
import { DEFAULT_VILLA_ID } from '../utils/villaContext'

// ── helpers ────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return String(d) }
}

// Villa's standard times, used whenever no early/late time was agreed for
// the individual stay. Raman needs a time on every row, not just the
// exceptional ones — "when am I opening the gate" is the whole question.
const VILLA_DEFAULTS = (CONFIG.villas || []).find(v => v.id === DEFAULT_VILLA_ID)
                    || (CONFIG.villas || [])[0] || {}

// '15:00' -> '3:00 PM'. Stored times are 24h; staff read 12h.
function fmtTime(t) {
  if (!t) return null
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return String(t)
  let h = parseInt(m[1], 10)
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m[2]} ${suffix}`
}

// When the guest is due in and out, and whether either was negotiated.
function stayTimes(s) {
  const inTime  = fmtTime(s.earlyCheckinTime) || VILLA_DEFAULTS.checkinTime  || '4:00 PM'
  const outTime = fmtTime(s.lateCheckoutTime) || VILLA_DEFAULTS.checkoutTime || '11:00 AM'
  return {
    inTime, outTime,
    inEarly:  !!s.earlyCheckinTime,
    outLate:  !!s.lateCheckoutTime,
    // A request with no agreed time still matters — it means a conversation
    // is open, and Raman should not be surprised at the door.
    inPending:  !s.earlyCheckinTime && !!s.requestEarlyCheckin,
    outPending: !s.lateCheckoutTime && !!s.requestLateCheckout,
    eta: fmtTime(s.eta),
  }
}

// Parses both stored 24h times ('23:00') and the config's 12h strings
// ('4:00 PM') into minutes past midnight, so the turnaround window can be
// measured whichever form each side happens to be in.
function toMinutes(v) {
  if (!v) return null
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const suffix = (m[3] || '').toUpperCase()
  if (suffix === 'PM' && h !== 12) h += 12
  if (suffix === 'AM' && h === 12) h = 0
  return h * 60 + parseInt(m[2], 10)
}

function fmtGap(mins) {
  if (mins == null) return null
  const sign = mins < 0 ? '-' : ''
  const a = Math.abs(mins)
  const h = Math.floor(a / 60), m = a % 60
  return m === 0 ? `${sign}${h} hrs` : `${sign}${h}h ${m}m`
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

  // TODAY means today. The old filter was daysUntil <= 1, which labelled
  // tomorrow's arrival TODAY — Prashansa showed as arriving today when she
  // was due the next day.
  const whenLabel = d =>
    d === 0 ? 'TODAY' : d === 1 ? 'TOMORROW' : `in ${d} days`
  const whenColour = d =>
    d === 0 ? '#34A853' : d === 1 ? '#F59E0B' : '#9AA5B4'

  return (
    <div style={{ marginBottom: '14px', background: 'rgba(52,168,83,0.05)',
      border: '1px solid rgba(52,168,83,0.25)', borderRadius: '12px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(52,168,83,0.12)',
        display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📋</span>
        <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#34A853', letterSpacing: '1.5px' }}>
          NEXT {upcoming.length} CHECK-IN{upcoming.length > 1 ? 'S' : ''}
        </span>
        <span style={{ marginLeft: 'auto', background: 'rgba(52,168,83,0.15)', color: '#34A853',
          fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
          {upcoming.length}
        </span>
      </div>

      {upcoming.map((s, i) => {
        const t = stayTimes(s)
        const imminent = s.daysUntil <= 1
        return (
          <div key={s.stayId || i}
            onClick={() => navigate('/raman/checkin')}
            style={{ padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: s.daysUntil === 0 ? 'rgba(52,168,83,0.07)' : 'transparent',
              borderBottom: i < upcoming.length - 1 ? '1px solid rgba(52,168,83,0.1)' : 'none' }}>
            <span style={{ fontSize: '1.1rem', lineHeight: '1.3' }}>{sourceIcon(s.source)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#F0F0F0',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.guestName}
              </div>
              <div style={{ fontSize: '0.72rem', color: imminent ? whenColour(s.daysUntil) : '#9AA5B4',
                marginTop: '2px', fontWeight: imminent ? '700' : '400' }}>
                {fmtDate(s.checkInDate)} · {s.adults} guest{s.adults > 1 ? 's' : ''} · {s.nights} night{s.nights > 1 ? 's' : ''}
              </div>

              {/* When to open the gate, and when they're due out */}
              <div style={{ fontSize: '0.7rem', marginTop: '4px', display: 'flex',
                flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center' }}>
                <span style={{ color: t.inEarly ? '#F59E0B' : '#9AA5B4' }}>
                  🔑 In {t.inTime}{t.inEarly ? ' (early)' : ''}
                </span>
                <span style={{ color: t.outLate ? '#F59E0B' : '#9AA5B4' }}>
                  🧳 Out {t.outTime}{t.outLate ? ' (late)' : ''}
                </span>
                {t.eta && (
                  <span style={{ color: '#85B7EB' }}>🚗 ETA {t.eta}</span>
                )}
              </div>

              {(t.inPending || t.outPending) && (
                <div style={{ fontSize: '0.68rem', color: '#F59E0B', marginTop: '3px' }}>
                  ⏳ {t.inPending ? 'Early check-in' : 'Late check-out'} requested — time not agreed yet
                </div>
              )}

              {/* Same-day turnaround — the villa has hours, not overnight */}
              {s.sameDayDeparture && (() => {
                const outT  = fmtTime(s.sameDayDeparture.lateCheckoutTime)
                            || VILLA_DEFAULTS.checkoutTime || '11:00 AM'
                const gap   = toMinutes(t.inTime) != null && toMinutes(outT) != null
                            ? toMinutes(t.inTime) - toMinutes(outT) : null
                const tight = gap != null && gap < 240   // under the 4 hrs a full reset needs
                return (
                  <div style={{ marginTop: '6px', padding: '7px 9px', borderRadius: '8px',
                    background: tight ? 'rgba(229,57,53,0.16)' : 'rgba(245,158,11,0.14)',
                    border: `1px solid ${tight ? 'rgba(229,57,53,0.55)' : 'rgba(245,158,11,0.45)'}` }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '800',
                      color: tight ? '#FF6B66' : '#F59E0B', letterSpacing: '0.5px' }}>
                      ⚠️ SAME-DAY TURNAROUND{gap != null ? ` · ${fmtGap(gap)} TO CLEAN` : ''}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#E8EDF3', marginTop: '2px', lineHeight: '1.45' }}>
                      {s.sameDayDeparture.guestName} leaves {outT}, {s.guestName.split(' ')[0]} arrives {t.inTime}
                    </div>
                  </div>
                )
              })()}
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', flexShrink: 0,
              color: whenColour(s.daysUntil),
              background: imminent ? 'rgba(52,168,83,0.2)' : 'transparent',
              padding: imminent ? '3px 8px' : '3px 0', borderRadius: '8px' }}>
              {whenLabel(s.daysUntil)}
            </span>
          </div>
        )
      })}
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
      api.getActiveStay(DEFAULT_VILLA_ID),
      api.getPendingCheckIns(),
      api.getRamanTodo(DEFAULT_VILLA_ID),
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
      title: 'Expenses',
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
      <TopBar title={CONFIG.villas[0]?.full || CONFIG.villas[0]?.name || CONFIG.brandName} sub="RAMAN · VILLA MANAGER" />

      <div className="screen-body">

        {/* ── TO-DO BLOCKS ── */}
        {loadingStay && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 0', marginBottom: '8px' }}>
            <div className="spinner"/>
            <span style={{ color: '#5C7080', fontSize: '0.85rem' }}>Loading…</span>
          </div>
        )}

        {/* ── WHO IS IN THE HOUSE RIGHT NOW ──
             Sits above the arrivals list deliberately. Raman's first question
             on opening the app is who he is looking after today, not who is
             due next — the upcoming list is planning, this is the job. */}
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

        {/* Who is coming next — planning, below today's job */}
        {!loadingStay && (
          <>
            <OverdueBlock  overdue={todo.overdue} />
            <UpcomingBlock upcoming={todo.upcoming} />
          </>
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
