import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const CUR_YEAR = new Date().getFullYear()
const YEARS = [CUR_YEAR, CUR_YEAR - 1, CUR_YEAR - 2, CUR_YEAR - 3]

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

// Bar chart rendered as SVG — last N harvests, amount + nut count trend
function BarChart({ harvests }) {
  if (!harvests || harvests.length === 0) return (
    <div style={{ color: '#5C7080', textAlign: 'center', padding: '32px', fontSize: '0.85rem' }}>
      No harvest data to display
    </div>
  )

  const data = [...harvests].slice(-24).reverse()
  const maxIncome = Math.max(...data.map(h => h.netIncome || 0), 1)
  const maxCount  = Math.max(...data.map(h => h.count || 0), 1)
  const W = 320, H = 160, pad = 28, barW = Math.max(8, Math.floor((W - pad * 2) / data.length) - 3)

  return (
    <svg viewBox={`0 0 ${W} ${H + 36}`} style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto' }}>
      {/* Y axis labels */}
      {[0, 0.5, 1].map(frac => {
        const y = pad + (1 - frac) * (H - pad)
        return (
          <g key={frac}>
            <line x1={pad} y1={y} x2={W - 8} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={pad - 4} y={y + 4} textAnchor="end" fill="#5C7080" fontSize="8">
              {fmt(maxIncome * frac)}
            </text>
          </g>
        )
      })}

      {/* Bars */}
      {data.map((h, i) => {
        const barH   = Math.max(2, ((h.netIncome || 0) / maxIncome) * (H - pad))
        const cntH   = Math.max(2, ((h.count || 0) / maxCount) * (H - pad))
        const x      = pad + i * (barW + 3)
        const isNeg  = (h.netIncome || 0) < 0
        const barColor = isNeg ? '#c62828' : '#0F6E56'
        return (
          <g key={i}>
            {/* Income bar */}
            <rect
              x={x} y={H - barH} width={barW * 0.6} height={barH}
              fill={barColor} rx="2" opacity="0.9"
            />
            {/* Count dot overlay */}
            <rect
              x={x + barW * 0.65} y={H - cntH} width={barW * 0.35} height={cntH}
              fill="#C8903A" rx="2" opacity="0.6"
            />
            {/* Month label */}
            <text x={x + barW / 2} y={H + 12} textAnchor="middle" fill="#5C7080" fontSize="7">
              {h.monthShort || ''}
            </text>
            <text x={x + barW / 2} y={H + 22} textAnchor="middle" fill="#3C5060" fontSize="6">
              {h.year ? String(h.year).slice(2) : ''}
            </text>
          </g>
        )
      })}

      {/* Legend */}
      <rect x={pad} y={H + 28} width={8} height={8} fill="#0F6E56" rx="1" />
      <text x={pad + 11} y={H + 35} fill="#8A9BAE" fontSize="8">Net income</text>
      <rect x={pad + 75} y={H + 28} width={8} height={8} fill="#C8903A" rx="1" />
      <text x={pad + 87} y={H + 35} fill="#8A9BAE" fontSize="8">Nut count</text>
    </svg>
  )
}

// Mock data for when API isn't connected
const MOCK = {
  totalHarvests: 8, totalCount: 9840, grossRevenue: 284320, totalExpense: 42800, netIncome: 241520,
  harvests: [
    { date: '02-May-2026', monthShort: 'May', year: 2026, count: 1240, weight: 620, pricePerKg: 28, harvester: 'Rajan', netIncome: 14938 },
    { date: '17-Mar-2026', monthShort: 'Mar', year: 2026, count: 1180, weight: 590, pricePerKg: 27, harvester: 'Rajan', netIncome: 14200 },
    { date: '31-Jan-2026', monthShort: 'Jan', year: 2026, count: 1320, weight: 660, pricePerKg: 26, harvester: 'Rajan', netIncome: 15400 },
    { date: '15-Nov-2025', monthShort: 'Nov', year: 2025, count: 1100, weight: 550, pricePerKg: 25, harvester: 'Rajan', netIncome: 11800 },
    { date: '01-Sep-2025', monthShort: 'Sep', year: 2025, count: 1280, weight: 640, pricePerKg: 26, harvester: 'Rajan', netIncome: 14700 },
    { date: '18-Jul-2025', monthShort: 'Jul', year: 2025, count: 980,  weight: 490, pricePerKg: 24, harvester: 'Rajan', netIncome: 10200 },
    { date: '04-May-2025', monthShort: 'May', year: 2025, count: 1150, weight: 575, pricePerKg: 25, harvester: 'Rajan', netIncome: 12900 },
    { date: '20-Mar-2025', monthShort: 'Mar', year: 2025, count: 1090, weight: 545, pricePerKg: 24, harvester: 'Rajan', netIncome: 11382 },
  ],
}

export default function CoconutDashboard() {
  const navigate  = useNavigate()
  const [year, setYear]     = useState(CUR_YEAR)
  const [showAll, setShowAll] = useState(false)
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getCoconutHarvests(year === 0 ? 'all' : year)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setData(MOCK); setLoading(false) })
  }, [year])

  const harvests = data?.harvests || []

  // Group by year for sorted display
  const byYear = harvests.reduce((acc, h) => {
    const y = h.year || CUR_YEAR
    if (!acc[y]) acc[y] = []
    acc[y].push(h)
    return acc
  }, {})
  const sortedYears = Object.keys(byYear).sort((a, b) => b - a)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Coconut dashboard</div>
          <div className="topbar-sub">POLLACHI ESTATE</div>
        </div>
      </div>

      <div className="screen-body">

        {/* Year filter */}
        <div className="month-strip" style={{ marginBottom: '12px' }}>
          <button className={`month-pill${year === 0 ? ' active' : ''}`} onClick={() => setYear(0)}>All</button>
          {YEARS.map(y => (
            <button key={y} className={`month-pill${year === y ? ' active' : ''}`} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" />Loading...</div>
        ) : (
          <>
            {/* Annual summary cards */}
            <div className="card-section-label">SUMMARY</div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Harvests</div>
                <div className="stat-val gold">{data?.totalHarvests || 0}</div>
                <div className="stat-sub">{year === 0 ? 'All time' : year}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total nuts</div>
                <div className="stat-val">{(data?.totalCount || 0).toLocaleString('en-IN')}</div>
                <div className="stat-sub">Gross count</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Gross revenue</div>
                <div className="stat-val green">{fmt(data?.grossRevenue)}</div>
                <div className="stat-sub">Before expenses</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Net income</div>
                <div className="stat-val green">{fmt(data?.netIncome)}</div>
                <div className="stat-sub">After all expenses</div>
              </div>
            </div>

            {/* Bar chart — last 24 harvests */}
            <div className="card-section-label" style={{ marginTop: '16px' }}>
              TREND — LAST {Math.min(harvests.length, 24)} HARVESTS
            </div>
            <div className="card" style={{ padding: '16px 8px' }}>
              <BarChart harvests={harvests} />
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#5C7080', fontSize: '0.68rem' }}>PEAK MONTH</div>
                  <div style={{ color: '#C8903A', fontSize: '0.82rem', fontWeight: '600' }}>
                    {harvests.length > 0 ? (harvests.reduce((a, b) => (b.netIncome || 0) > (a.netIncome || 0) ? b : a)).monthShort : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#5C7080', fontSize: '0.68rem' }}>AVG/HARVEST</div>
                  <div style={{ color: '#85B7EB', fontSize: '0.82rem', fontWeight: '600' }}>
                    {harvests.length > 0 ? fmt(Math.round((data?.netIncome || 0) / harvests.length)) : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#5C7080', fontSize: '0.68rem' }}>TOTAL EXPENSE</div>
                  <div style={{ color: '#EF9A9A', fontSize: '0.82rem', fontWeight: '600' }}>
                    {fmt(data?.totalExpense)}
                  </div>
                </div>
              </div>
            </div>

            {/* Harvest history sorted by year */}
            {sortedYears.map(y => (
              <div key={y}>
                <div className="card-section-label" style={{ marginTop: '16px' }}>{y}</div>
                {byYear[y].map((h, i) => (
                  <div key={i} className="card" style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ color: '#C8903A', fontWeight: '600', fontSize: '0.9rem' }}>{h.date}</span>
                      <span style={{ color: (h.netIncome || 0) >= 0 ? 'var(--green)' : '#EF9A9A', fontWeight: '700' }}>
                        {fmt(h.netIncome)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>COUNT</div><div style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '0.85rem' }}>{(h.count || 0).toLocaleString('en-IN')}</div></div>
                      <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>WEIGHT</div><div style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '0.85rem' }}>{h.weight}kg</div></div>
                      <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>₹/KG</div><div style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '0.85rem' }}>₹{h.pricePerKg}</div></div>
                      <div><div style={{ color: '#5C7080', fontSize: '0.68rem' }}>HARVESTER</div><div style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '0.85rem' }}>{h.harvester || '—'}</div></div>
                      {h.balanceDue !== undefined && (
                        <div>
                          <div style={{ color: '#5C7080', fontSize: '0.68rem' }}>BALANCE</div>
                          <div style={{ color: h.balanceDue === 0 ? '#34A853' : '#FFCC80', fontWeight: '600', fontSize: '0.85rem' }}>
                            {h.balanceDue === 0 ? '✓ Settled' : fmt(h.balanceDue)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {harvests.length === 0 && (
              <div style={{ color: '#5C7080', textAlign: 'center', padding: '32px', fontSize: '0.85rem' }}>
                No harvests recorded for {year === 0 ? 'any year' : year}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
