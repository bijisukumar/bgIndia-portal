import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { CONFIG } from '../config'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CUR_MONTH = new Date().getMonth()
const CUR_YEAR  = new Date().getFullYear()

const INCOME_FIELDS = [
  { key: 'rent',         label: 'Rent received',      color: 'green', sign: 1 },
  { key: 'carParking',   label: 'Car parking',         color: 'green', sign: 1 },
]
const EXPENSE_FIELDS = [
  { key: 'maintenance',       label: 'Maintenance fee',    color: 'red',  sign: -1 },
  { key: 'electricity',       label: 'Electricity',        color: 'red',  sign: -1 },
  { key: 'water',             label: 'Water',              color: 'red',  sign: -1 },
  { key: 'propertyTax',       label: 'Property tax',       color: 'red',  sign: -1 },
  { key: 'landTax',           label: 'Land tax',           color: 'red',  sign: -1 },
  { key: 'extraMaintenance',  label: 'Add. maintenance',   color: 'red',  sign: -1 },
]
const ALL_FIELDS = [...INCOME_FIELDS, ...EXPENSE_FIELDS]

function emptyProp() { return Object.fromEntries(ALL_FIELDS.map(f => [f.key, '0'])) }
function calcIncome(p) { return INCOME_FIELDS.reduce((s, f) => s + (parseFloat(p[f.key]) || 0), 0) }
function calcExpense(p) { return EXPENSE_FIELDS.reduce((s, f) => s + (parseFloat(p[f.key]) || 0), 0) }
function calcNet(p) { return calcIncome(p) - calcExpense(p) }

function fmt(n) {
  if (n === undefined || n === null) return '—'
  const abs = Math.abs(n)
  const s = abs >= 100000 ? `₹${(abs/100000).toFixed(1)}L` : abs >= 1000 ? `₹${(abs/1000).toFixed(1)}K` : `₹${abs.toLocaleString('en-IN')}`
  return n < 0 ? `−${s}` : s
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr), now = new Date()
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24))
}

export default function RentalProperties() {
  const navigate = useNavigate()
  const [tab, setTab]       = useState('tracker')   // 'tracker' | 'dashboard'
  const [month, setMonth]   = useState(CUR_MONTH)
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)
  const [data, setData]     = useState(CONFIG.rentalProperties.map(() => emptyProp()))
  const [dashData, setDashData] = useState(null)
  const [dashLoading, setDashLoading] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const set = (pi, key, val) => setData(d => d.map((p, i) => i === pi ? { ...p, [key]: val } : p))

  const totalNet = data.reduce((s, p) => s + calcNet(p), 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.saveRentalIncome({ month, year: CUR_YEAR, properties: data })
      showToast('Rental income saved ✓')
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  useEffect(() => {
    if (tab === 'dashboard' && !dashData) {
      setDashLoading(true)
      api.getRentalDashboard(CUR_YEAR)
        .then(d => { setDashData(d); setDashLoading(false) })
        .catch(() => { setDashData(MOCK_DASH); setDashLoading(false) })
    }
  }, [tab])

  // Renewal alerts — check lease_end from config if present
  const renewals = CONFIG.rentalProperties
    .map((p, i) => ({ ...p, idx: i, days: p.leaseEnd ? daysUntil(p.leaseEnd) : null }))
    .filter(p => p.days !== null && p.days <= 60)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Rental properties</div>
          <div className="topbar-sub">MONTHLY INCOME TRACKER</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={tabBar}>
        <button style={tab === 'tracker' ? tabActive : tabInactive} onClick={() => setTab('tracker')}>📋 Monthly entry</button>
        <button style={tab === 'dashboard' ? tabActive : tabInactive} onClick={() => setTab('dashboard')}>📊 Dashboard</button>
      </div>

      <div className="screen-body">

        {/* RENEWAL ALERTS */}
        {renewals.length > 0 && (
          <div style={{ background: 'rgba(198,40,40,0.1)', border: '1px solid rgba(198,40,40,0.3)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ color: '#EF9A9A', fontWeight: '600', fontSize: '0.82rem', marginBottom: '6px' }}>
              🔔 Renewal alerts
            </div>
            {renewals.map(p => (
              <div key={p.idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: '#EDF2F7', fontSize: '0.82rem' }}>{p.name}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: p.days < 0 ? '#EF9A9A' : '#FFCC80', fontSize: '0.78rem' }}>
                    {p.days < 0 ? `Expired ${Math.abs(p.days)}d ago` : `${p.days}d left`}
                  </span>
                  <button
                    style={{ background: 'rgba(52,168,83,0.15)', border: '1px solid rgba(52,168,83,0.3)', borderRadius: '8px', color: '#34A853', fontSize: '0.72rem', padding: '2px 8px', cursor: 'pointer' }}
                    onClick={() => showToast(`Renewal email draft opened for ${p.name}`)}
                  >
                    📧 Renew
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: TRACKER ──────────────────────────────────── */}
        {tab === 'tracker' && (
          <>
            <div className="month-strip">
              {MONTHS.map((m, i) => (
                <button key={m} className={`month-pill${month === i ? ' active' : ''}`} onClick={() => setMonth(i)}>{m}</button>
              ))}
            </div>

            {CONFIG.rentalProperties.map((prop, pi) => {
              const p   = data[pi]
              const inc = calcIncome(p)
              const exp = calcExpense(p)
              const net = inc - exp
              return (
                <div key={prop.id}>
                  <div className="card-section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{prop.name.toUpperCase()}</span>
                    <span style={{ color: net >= 0 ? '#34A853' : '#EF9A9A', fontWeight: '700' }}>{fmt(net)}</span>
                  </div>
                  <div className="card">
                    {/* Tenant info */}
                    {prop.tenantName && (
                      <div style={{ color: '#5C7080', fontSize: '0.75rem', marginBottom: '10px' }}>
                        Tenant: <span style={{ color: '#EDF2F7' }}>{prop.tenantName}</span>
                        {prop.leaseEnd && <span style={{ marginLeft: '8px', color: daysUntil(prop.leaseEnd) < 30 ? '#FFCC80' : '#5C7080' }}>· Lease ends {prop.leaseEnd}</span>}
                      </div>
                    )}
                    {/* Income fields */}
                    <div style={{ fontSize: '0.7rem', color: '#34A853', letterSpacing: '1px', marginBottom: '6px' }}>INCOME</div>
                    <div className="grid-2">
                      {INCOME_FIELDS.map(f => (
                        <div key={f.key} className="field">
                          <label className="field-label">{f.label}</label>
                          <input className="field-input" type="number" placeholder="0"
                            style={{ color: '#34A853' }} value={p[f.key]}
                            onChange={e => set(pi, f.key, e.target.value)} />
                        </div>
                      ))}
                    </div>
                    <div className="divider" />
                    {/* Expense fields */}
                    <div style={{ fontSize: '0.7rem', color: '#EF9A9A', letterSpacing: '1px', marginBottom: '6px' }}>EXPENSES</div>
                    <div className="grid-2">
                      {EXPENSE_FIELDS.map(f => (
                        <div key={f.key} className="field">
                          <label className="field-label">{f.label}</label>
                          <input className="field-input" type="number" placeholder="0"
                            style={{ color: '#EF9A9A' }} value={p[f.key]}
                            onChange={e => set(pi, f.key, e.target.value)} />
                        </div>
                      ))}
                    </div>
                    <div className="divider" />
                    {/* Mini P&L */}
                    <div style={{ display: 'flex', gap: '20px', paddingTop: '4px' }}>
                      <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>INCOME</div><div style={{ color: '#34A853', fontWeight: '700' }}>{fmt(inc)}</div></div>
                      <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>EXPENSE</div><div style={{ color: '#EF9A9A', fontWeight: '700' }}>{fmt(exp)}</div></div>
                      <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>NET</div><div style={{ color: net >= 0 ? '#34A853' : '#EF9A9A', fontWeight: '700' }}>{fmt(net)}</div></div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Total */}
            <div className="net-box" style={{ marginTop: '8px' }}>
              <div className="net-row">
                <span style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '1rem' }}>
                  Total net — {MONTHS[month]} {CUR_YEAR}
                </span>
                <span className={`net-val big ${totalNet < 0 ? 'neg' : ''}`}>{fmt(totalNet)}</span>
              </div>
            </div>

            <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : `Save ${MONTHS[month]} income →`}
            </button>
            <p className="btn-email-note">📧 Owner notified on save</p>
          </>
        )}

        {/* ── TAB: DASHBOARD ────────────────────────────────── */}
        {tab === 'dashboard' && (
          dashLoading ? (
            <div className="loading"><div className="spinner" />Loading...</div>
          ) : (
            <>
              <div className="card-section-label">ANNUAL SUMMARY — {CUR_YEAR}</div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total income</div>
                  <div className="stat-val green">{fmt(dashData?.totalIncome)}</div>
                  <div className="stat-sub">All properties</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total expenses</div>
                  <div className="stat-val" style={{ color: '#EF9A9A' }}>{fmt(dashData?.totalExpense)}</div>
                  <div className="stat-sub">All properties</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Net income</div>
                  <div className="stat-val green">{fmt(dashData?.netIncome)}</div>
                  <div className="stat-sub">After expenses</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Occupancy</div>
                  <div className="stat-val gold">{dashData?.occupancyPct || '—'}</div>
                  <div className="stat-sub">Months paid</div>
                </div>
              </div>

              {/* Per property breakdown */}
              {(dashData?.properties || CONFIG.rentalProperties).map((prop, i) => (
                <div key={prop.id || i}>
                  <div className="card-section-label">{(prop.name || prop).toUpperCase()}</div>
                  <div className="card">
                    {prop.monthlyNet ? (
                      <>
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                          <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>YTD INCOME</div><div style={{ color: '#34A853', fontWeight: '700' }}>{fmt(prop.ytdIncome)}</div></div>
                          <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>YTD EXPENSE</div><div style={{ color: '#EF9A9A', fontWeight: '700' }}>{fmt(prop.ytdExpense)}</div></div>
                          <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>YTD NET</div><div style={{ color: (prop.ytdNet || 0) >= 0 ? '#34A853' : '#EF9A9A', fontWeight: '700' }}>{fmt(prop.ytdNet)}</div></div>
                        </div>
                        {/* Monthly bars */}
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '48px' }}>
                          {prop.monthlyNet.map((net, mi) => {
                            const maxAbs = Math.max(...prop.monthlyNet.map(Math.abs), 1)
                            const barH   = Math.max(2, (Math.abs(net) / maxAbs) * 44)
                            return (
                              <div key={mi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: '100%', height: `${barH}px`, background: net >= 0 ? '#0F6E56' : '#c62828', borderRadius: '2px', opacity: mi > CUR_MONTH ? 0.3 : 0.9 }} />
                                <div style={{ color: '#3C5060', fontSize: '6px', marginTop: '2px' }}>{MONTHS[mi].slice(0,1)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#5C7080', fontSize: '0.82rem' }}>No data recorded yet</div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

const tabBar = { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111' }
const tabBase = { flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', letterSpacing: '0.5px', transition: 'all 0.2s' }
const tabActive = { ...tabBase, background: 'rgba(200,144,58,0.1)', color: '#C8903A', borderBottom: '2px solid #C8903A' }
const tabInactive = { ...tabBase, background: 'transparent', color: '#5C7080', borderBottom: '2px solid transparent' }

const MOCK_DASH = {
  totalIncome: 312000, totalExpense: 48600, netIncome: 263400, occupancyPct: '92%',
  properties: [
    { id: 'rental_1', name: 'Property A', ytdIncome: 108000, ytdExpense: 16200, ytdNet: 91800, monthlyNet: [9000,9000,9000,9000,9000,9000,9000,9000,9000,0,0,0] },
    { id: 'rental_2', name: 'Property B', ytdIncome: 96000,  ytdExpense: 15600, ytdNet: 80400, monthlyNet: [8000,8000,8000,8000,8000,8000,8000,8000,8000,0,0,0] },
    { id: 'rental_3', name: 'Property C', ytdIncome: 108000, ytdExpense: 16800, ytdNet: 91200, monthlyNet: [9000,9000,9000,9000,9000,9000,9000,9000,9000,0,0,0] },
  ]
}
