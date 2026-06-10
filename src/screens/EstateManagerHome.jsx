import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api'
import TopBar from '../components/TopBar'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function EstateManagerHome() {
  const { logout }    = useAuth()
  const navigate      = useNavigate()
  const [info, setInfo]           = useState(null)
  const [marketPrice, setMarketPrice] = useState(null)
  const [marketLoading, setMarketLoading] = useState(true)

  useEffect(() => {
    api.getManagerQuickInfo()
      .then(d => setInfo(d))
      .catch(() => setInfo(null))
  }, [])

  useEffect(() => {
    api.getCoconutMarketPrice()
      .then(d => setMarketPrice(d))
      .catch(() => setMarketPrice(null))
      .finally(() => setMarketLoading(false))
  }, [])

  const handleIrrigationTap = () => navigate('/pollachi/irrigation')

  const rows = [
    {
      icon: '🌴', title: 'Irrigation log', sub: 'Daily zone tracking',
      action: handleIrrigationTap,
      alert: info?.irrigationAlert,
    },
    {
      icon: '🌿', title: 'Income / expense', sub: 'Monthly ledger',
      action: () => navigate('/pollachi/ledger'),
    },
    {
      icon: '🥥', title: 'Coconut tracker', sub: 'Harvest · count · weight · revenue',
      action: () => navigate('/pollachi/coconut'),
    },
    {
      icon: '🥭', title: 'Mango harvest', sub: 'Box tracking · varieties · season totals',
      action: () => navigate('/pollachi/mango'),
    },
    {
      icon: '📊', title: 'Pollachi dashboard', sub: 'Harvest history · income · expenses',
      action: () => navigate('/pollachi/dashboard'),
    },
  ]

  const irrigationDays = info?.irrigationDaysAgo ?? null
  const harvestDays    = info?.harvestDaysAway    ?? null
  const lastPrice      = info?.lastPricePerKg     ?? null

  return (
    <div className="screen">
      <TopBar title={info?.managerName || 'Estate Manager'} sub={`ESTATE MANAGER · ${(info?.estateId || 'ESTATE').toUpperCase()}`} />

      <div className="screen-body">

        {/* ── IRRIGATION ALERT BANNER ── */}
        {info?.irrigationAlert && (
          <div style={s.alertBanner} onClick={handleIrrigationTap}>
            <span style={s.alertIcon}>🚨</span>
            <div style={s.alertText}>
              <div style={s.alertTitle}>Irrigation data missing</div>
              <div style={s.alertSub}>
                {irrigationDays === null
                  ? 'No irrigation log found — please log today'
                  : `Last logged ${irrigationDays} days ago — over 2 weeks`}
              </div>
            </div>
            <span style={s.alertArrow}>›</span>
          </div>
        )}

        {/* ── MENU ── */}
        <div className="card-section-label">POLLACHI COCONUT ESTATE</div>
        <div style={s.estateCard}>
          <div style={s.estateHeader}>
            <span style={s.estateName}>Pollachi Estate</span>
            <span style={s.estateTag}>Active</span>
          </div>
          {rows.map((row, i) => (
            <div
              key={i}
              className="menu-row"
              onClick={row.action}
              style={{
                ...(i === rows.length - 1 ? { borderBottom: 'none' } : {}),
                position: 'relative',
              }}
            >
              <div className="menu-icon" style={{ background: 'rgba(59,109,17,0.08)' }}>
                {row.icon}
              </div>
              <div className="menu-label">
                <div className="menu-title" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {row.title}
                  {row.alert && (
                    <span style={s.alertDot}>!</span>
                  )}
                </div>
                <div className="menu-sub">{row.sub}</div>
              </div>
              <div className="menu-arrow" style={{ background: '#3B6D11' }}>›</div>
            </div>
          ))}
        </div>

        {/* ── QUICK INFO ── */}
        <div className="card-section-label" style={{ marginTop: 20 }}>QUICK INFO</div>
        <div style={s.infoStrip}>

          {/* Next harvest date */}
          <div style={s.infoItem}>
            <div style={{
              ...s.infoVal,
              color: harvestDays !== null && harvestDays < 7 ? '#EF9A9A'
                   : harvestDays !== null && harvestDays < 14 ? '#FFCC80'
                   : '#C8903A',
              fontSize: '0.82rem',
            }}>
              {info?.nextHarvestDate ? fmtDate(info.nextHarvestDate) : '—'}
            </div>
            <div style={s.infoLabel}>
              Next harvest
              {harvestDays !== null && (
                <div style={{ color: harvestDays < 0 ? '#EF9A9A' : '#5C7080' }}>
                  {harvestDays < 0 ? `${Math.abs(harvestDays)}d overdue` : `in ${harvestDays}d`}
                </div>
              )}
            </div>
          </div>

          <div style={s.infoDivider} />

          {/* Irrigation status */}
          <div style={s.infoItem}>
            <div style={{
              ...s.infoVal,
              color: info?.irrigationAlert ? '#EF9A9A' : '#4CAF50',
              fontSize: '0.85rem',
            }}>
              {irrigationDays === null ? 'Never' : `${irrigationDays}d ago`}
            </div>
            <div style={{
              ...s.infoLabel,
              color: info?.irrigationAlert ? '#EF9A9A' : '#5C7080',
            }}>
              Irrigation
              {info?.irrigationAlert && <div>⚠ Log now</div>}
            </div>
          </div>

          <div style={s.infoDivider} />

          {/* Last coconut price */}
          <div style={s.infoItem}>
            <div style={s.infoVal}>
              {lastPrice ? `₹${lastPrice}/kg` : '—'}
            </div>
            <div style={s.infoLabel}>Last price</div>
          </div>

        </div>

        {/* ── COCONUT MARKET PRICE ── */}
        <div className="card-section-label" style={{ marginTop: 16 }}>🥥 MARKET PRICE TODAY</div>
        <div style={s.marketCard}>
          {marketLoading ? (
            <div style={s.marketLoading}>Fetching live prices…</div>
          ) : !marketPrice || (!marketPrice.pollachiGreen && !marketPrice.pollachiBlack && !marketPrice.thrissur) ? (
            <div style={s.marketLoading}>Price data unavailable</div>
          ) : (
            <>
              <div style={s.marketGrid}>
                {[
                  { label: 'Pollachi (Green)', data: marketPrice.pollachiGreen },
                  { label: 'Pollachi (Black)', data: marketPrice.pollachiBlack },
                  { label: 'Thrissur',         data: marketPrice.thrissur },
                ].map(({ label, data }) => (
                  <div key={label} style={s.marketItem}>
                    <div style={s.marketPrice}>
                      {data ? `₹${data.price}/kg` : '—'}
                    </div>
                    <div style={s.marketLabel}>{label}</div>
                    {data?.date && (
                      <div style={s.marketDate}>{data.date}</div>
                    )}
                  </div>
                ))}
              </div>
              {marketPrice.fetchedAt && (
                <div style={s.marketFetched}>
                  Source: coconutboard.in · fetched {new Date(marketPrice.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </>
          )}
        </div>

        <button className="logout-btn" onClick={logout} style={{ marginTop: 8 }}>Log out</button>
      </div>
    </div>
  )
}

const s = {
  alertBanner: {
    background: 'rgba(198,40,40,0.1)',
    border: '1px solid rgba(198,40,40,0.35)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
  },
  alertIcon:  { fontSize: '1.2rem' },
  alertText:  { flex: 1 },
  alertTitle: { color: '#EF9A9A', fontWeight: 700, fontSize: '0.85rem' },
  alertSub:   { color: '#EF9A9A', fontSize: '0.72rem', marginTop: 2, opacity: 0.8 },
  alertArrow: { color: '#EF9A9A', fontSize: '1.2rem' },

  alertDot: {
    background: '#c62828',
    color: '#fff',
    borderRadius: '50%',
    width: 16, height: 16,
    fontSize: '0.6rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  estateCard: {
    background: '#1E2535',
    borderRadius: 14,
    border: '1px solid rgba(59,109,17,0.2)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  estateHeader: {
    background: 'rgba(59,109,17,0.08)',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(59,109,17,0.15)',
  },
  estateName: { color: '#81C995', fontSize: '0.85rem', fontWeight: 700 },
  estateTag: {
    fontSize: '0.7rem', padding: '2px 10px', borderRadius: 10,
    background: 'rgba(52,168,83,0.15)', color: '#81C995', fontWeight: 700,
  },

  infoStrip: {
    background: '#1E2535',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '14px 10px',
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoItem:    { flex: 1, textAlign: 'center' },
  infoVal:     { color: '#C8903A', fontSize: '0.92rem', fontWeight: 700 },
  infoLabel:   { color: '#5C7080', fontSize: '0.65rem', marginTop: 3, lineHeight: 1.4 },
  infoDivider: { width: 1, height: 48, background: 'rgba(255,255,255,0.06)', flexShrink: 0 },

  marketCard:    { background: '#1E2535', borderRadius: 12, border: '1px solid rgba(15,110,86,0.25)', padding: '14px 12px', marginBottom: 8 },
  marketGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: 6 },
  marketItem:    { textAlign: 'center', background: 'rgba(15,110,86,0.06)', borderRadius: 8, padding: '10px 6px', border: '1px solid rgba(15,110,86,0.12)' },
  marketPrice:   { color: '#4CAF50', fontSize: '1rem', fontWeight: 700 },
  marketLabel:   { color: '#5C7080', fontSize: '0.6rem', marginTop: 4, lineHeight: 1.3 },
  marketDate:    { color: '#3A4A40', fontSize: '0.58rem', marginTop: 2 },
  marketLoading: { color: '#5C7080', textAlign: 'center', fontSize: '0.78rem', padding: '12px 0' },
  marketFetched: { color: '#3A4A40', fontSize: '0.6rem', textAlign: 'center', marginTop: 4 },
}
