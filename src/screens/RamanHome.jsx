import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { CONFIG } from '../config'

export default function RamanHome() {
  const navigate = useNavigate()
  const [activeStay,   setActiveStay]   = useState(null)
  const [readyCount,   setReadyCount]   = useState(0)   // guests in ready_for_checkin
  const [loadingStay,  setLoadingStay]  = useState(true)

  useEffect(() => {
    Promise.all([
      api.getActiveStay('dwarka'),
      api.getPendingCheckIns(),
    ]).then(([stay, pending]) => {
      setActiveStay(stay || null)
      setReadyCount(Array.isArray(pending) ? pending.length : 0)
      setLoadingStay(false)
    }).catch(() => setLoadingStay(false))
  }, [])

  // Kitchen/Breakfast/Car rental unlock when there is an active checked-in stay
  // They are intentionally locked without one — charges must be linked to a stay
  const activeLabel = activeStay
    ? `Linked to ${activeStay.guestName || activeStay.guest_name}`
    : readyCount > 0
      ? `${readyCount} guest${readyCount>1?'s':''} ready — complete check-in first`
      : 'Unlocks after guest checks in'

  const MENU = [
    {
      icon: '🏠', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Check-in',
      sub: readyCount > 0
        ? `${readyCount} guest${readyCount>1?'s':''} ready for check-in`
        : activeStay
          ? `Active: ${activeStay.guestName || activeStay.guest_name}`
          : 'No guests ready yet',
      path: '/raman/checkin',
      disabled: false,
      badge: readyCount > 0 ? readyCount : null,
    },
    {
      icon: '🛒', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Kitchen incidentals',
      sub: activeLabel,
      path: '/raman/kitchen',
      // Only lock if no active stay — unlock so Raman can always enter, but warn
      disabled: !activeStay,
      lockReason: 'Guest must be checked in to record kitchen charges',
    },
    {
      icon: '🍳', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Breakfast',
      sub: activeStay
        ? `${activeStay.guestCount || activeStay.adults || ''} guests · ₹${CONFIG.breakfastRate}/person`
        : activeLabel,
      path: '/raman/breakfast',
      disabled: !activeStay,
      lockReason: 'Guest must be checked in to record breakfast',
    },
    {
      icon: '🚗', bg: 'rgba(200,144,58,0.08)', arrow: '#C8903A',
      title: 'Car rental',
      sub: activeStay ? `Linked to ${activeStay.guestName || activeStay.guest_name}` : activeLabel,
      path: '/raman/carrental',
      disabled: !activeStay,
      lockReason: 'Guest must be checked in to record car rental',
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
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {CONFIG.logo && <img src={CONFIG.logo} alt="logo" style={{ height: 36, borderRadius: 6 }}/>}
          <div>
            <div className="topbar-title">{CONFIG.villaName || 'Guruvayur Estates'}</div>
            <div className="topbar-sub">PROPERTY MANAGEMENT PORTAL</div>
          </div>
        </div>
        <span style={{ background: 'rgba(200,144,58,0.15)', color: 'var(--gold)',
          padding: '4px 12px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: '700' }}>
          RAMAN
        </span>
      </div>

      <div className="screen-body">

        {/* Active stay banner / status */}
        {loadingStay ? (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 0', marginBottom:'8px' }}>
            <div className="spinner"/><span style={{ color:'#5C7080', fontSize:'0.85rem' }}>Checking active stay…</span>
          </div>
        ) : activeStay ? (
          <div className="active-stay-banner" onClick={() => navigate('/raman/checkin')}>
            <div className="active-stay-icon">🏠</div>
            <div style={{ flex: 1 }}>
              <div className="active-stay-name">Active: {activeStay.guestName || activeStay.guest_name}</div>
              <div className="active-stay-sub">
                Check-in {activeStay.checkInDate || activeStay.checkin_date || ''} · {activeStay.adults || ''} guests
              </div>
            </div>
            <span style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>›</span>
          </div>
        ) : readyCount > 0 ? (
          <div className="active-stay-banner" style={{ borderColor: 'rgba(52,168,83,0.4)',
            background: 'rgba(52,168,83,0.06)' }}
            onClick={() => navigate('/raman/checkin')}>
            <div style={{ fontSize: '1.3rem' }}>🔑</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#34A853', fontWeight: '700', fontSize: '0.9rem' }}>
                {readyCount} guest{readyCount>1?'s':''} ready for check-in
              </div>
              <div className="active-stay-sub">Tap to open Check-in screen</div>
            </div>
            <span style={{ color: '#34A853', fontSize: '1.1rem' }}>›</span>
          </div>
        ) : (
          <div style={{ background: 'rgba(92,112,128,0.08)', border: '1px solid rgba(92,112,128,0.2)',
            borderRadius: '12px', padding: '12px 16px', marginBottom: '14px',
            display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '1.3rem' }}>🏠</div>
            <div>
              <div style={{ color: '#C8903A', fontSize: '0.85rem', fontWeight: '600' }}>No active stay</div>
              <div style={{ color: '#5C7080', fontSize: '0.75rem', marginTop: '2px' }}>
                Owner marks guests "Ready for Check-in" — they appear here
              </div>
            </div>
          </div>
        )}

        <div className="card-section-label">GVR DWARKA VILLA</div>
        <div className="menu-tile">
          {MENU.map((item, i) => (
            <div key={i}
              className={`menu-row ${item.disabled ? 'menu-row-disabled' : ''}`}
              style={{ borderBottom: i < MENU.length - 1 ? '1px solid var(--border-dim)' : 'none',
                       opacity: item.disabled ? 0.55 : 1 }}
              onClick={() => {
                if (item.disabled) {
                  // Show why it's locked — brief feedback
                  return
                }
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
                  padding: '2px 8px', fontSize: '0.75rem', fontWeight: '700', minWidth: '20px',
                  textAlign: 'center' }}>
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
