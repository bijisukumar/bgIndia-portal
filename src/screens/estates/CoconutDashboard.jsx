import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const CUR_YEAR = new Date().getFullYear()
const YEARS    = [0, CUR_YEAR, CUR_YEAR - 1, CUR_YEAR - 2, CUR_YEAR - 3]

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}
function rejPct(count, rejected) {
  if (!count || count === 0) return '0%'
  return ((rejected / count) * 100).toFixed(1) + '%'
}

// ── Nut Count trend chart ────────────────────────────────────
function NutTrendChart({ harvests }) {
  if (!harvests?.length) return <div style={s.empty}>No data</div>
  const data    = [...harvests].reverse() // oldest → newest
  const maxNuts = Math.max(...data.map(h => h.count), 1)
  const W = 320, H = 120, pad = 36, barW = Math.max(8, Math.floor((W - pad * 2) / data.length) - 2)

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width:'100%', display:'block' }}>
      {[0, 0.5, 1].map(f => {
        const y = pad + (1 - f) * (H - pad)
        return (
          <g key={f}>
            <line x1={pad} y1={y} x2={W - 8} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            <text x={pad - 4} y={y + 3} textAnchor="end" fill="#5C7080" fontSize="7">
              {Math.round(maxNuts * f).toLocaleString('en-IN')}
            </text>
          </g>
        )
      })}
      {data.map((h, i) => {
        const barH = Math.max(3, (h.count / maxNuts) * (H - pad))
        const x    = pad + i * (barW + 2)
        return (
          <g key={i}>
            <rect x={x} y={H - barH} width={barW} height={barH} fill="#0F6E56" rx="2" opacity="0.85"/>
            <text x={x + barW / 2} y={H + 10} textAnchor="middle" fill="#5C7080" fontSize="6.5">
              {h.monthShort}
            </text>
            <text x={x + barW / 2} y={H + 19} textAnchor="middle" fill="#3C5060" fontSize="5.5">
              {String(h.year).slice(2)}
            </text>
          </g>
        )
      })}
      <rect x={pad} y={H + 25} width={8} height={6} fill="#0F6E56" rx="1"/>
      <text x={pad + 11} y={H + 30} fill="#8A9BAE" fontSize="7">Nut count</text>
    </svg>
  )
}

// ── Rate trend chart (₹/kg by year) ──────────────────────────
function RateTrendChart({ harvests }) {
  if (!harvests?.length) return <div style={s.empty}>No data</div>

  // Group avg rate by year
  const byYear = {}
  harvests.forEach(h => {
    if (!byYear[h.year]) byYear[h.year] = { total: 0, count: 0 }
    byYear[h.year].total += h.pricePerKg
    byYear[h.year].count += 1
  })
  const years   = Object.keys(byYear).sort()
  const avgRates = years.map(y => ({ year: y, rate: Math.round(byYear[y].total / byYear[y].count) }))
  const maxRate  = Math.max(...avgRates.map(r => r.rate), 1)
  const W = 320, H = 100, pad = 36

  // Also show individual harvest rate dots
  const data    = [...harvests].reverse()
  const barW    = Math.max(8, Math.floor((W - pad * 2) / data.length) - 2)

  return (
    <svg viewBox={`0 0 ${W} ${H + 50}`} style={{ width:'100%', display:'block' }}>
      {[0, 0.5, 1].map(f => {
        const y = pad + (1 - f) * (H - pad)
        return (
          <g key={f}>
            <line x1={pad} y1={y} x2={W - 8} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            <text x={pad - 4} y={y + 3} textAnchor="end" fill="#5C7080" fontSize="7">
              ₹{Math.round(maxRate * f)}
            </text>
          </g>
        )
      })}
      {data.map((h, i) => {
        const barH = Math.max(3, (h.pricePerKg / maxRate) * (H - pad))
        const x    = pad + i * (barW + 2)
        return (
          <g key={i}>
            <rect x={x} y={H - barH} width={barW} height={barH} fill="#C8903A" rx="2" opacity="0.8"/>
            <text x={x + barW / 2} y={H + 10} textAnchor="middle" fill="#5C7080" fontSize="6.5">
              {h.monthShort}
            </text>
            <text x={x + barW / 2} y={H + 19} textAnchor="middle" fill="#3C5060" fontSize="5.5">
              {String(h.year).slice(2)}
            </text>
          </g>
        )
      })}
      {/* Year avg annotations */}
      {avgRates.map((r, i) => (
        <text key={i} x={pad + (i + 0.5) * ((W - pad * 2) / avgRates.length)}
          y={H + 32} textAnchor="middle" fill="#C8903A" fontSize="7.5" fontWeight="700">
          {r.year}: ₹{r.rate}/kg avg
        </text>
      ))}
      <rect x={pad} y={H + 42} width={8} height={6} fill="#C8903A" rx="1"/>
      <text x={pad + 11} y={H + 47} fill="#8A9BAE" fontSize="7">₹/kg per harvest</text>
    </svg>
  )
}

export default function CoconutDashboard() {
  const navigate  = useNavigate()
  const [year, setYear]       = useState(0)  // 0 = All
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getCoconutHarvests(year === 0 ? 'all' : year)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [year])

  const harvests = data?.harvests || []

  // Compute delay between harvests (days)
  const withDelay = harvests.map((h, i) => {
    const prev  = harvests[i + 1]
    const delay = prev ? daysBetween(prev.date, h.date) : null
    return { ...h, delay }
  })

  // Next harvest date — from most recent record's next_harvest_date
  const nextHarvestDate = data?.nextHarvestDate
    || (harvests[0]?.nextHarvest)
    || null

  const daysToNext = nextHarvestDate
    ? daysBetween(new Date().toISOString().slice(0, 10), nextHarvestDate)
    : null

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Coconut Dashboard</div>
          <div className="topbar-sub">POLLACHI ESTATE · PRADOSH</div>
        </div>
      </div>

      <div className="screen-body">

        {/* ── NEXT HARVEST BANNER ── */}
        <div style={{
          ...s.nextBanner,
          borderColor: daysToNext !== null && daysToNext <= 7 ? 'rgba(200,80,80,0.5)' : 'rgba(200,144,58,0.3)',
          background:  daysToNext !== null && daysToNext <= 7 ? 'rgba(200,80,80,0.08)' : 'rgba(200,144,58,0.06)',
        }}>
          <div style={s.nextLabel}>NEXT HARVEST</div>
          <div style={s.nextDate}>
            {nextHarvestDate ? fmtDate(nextHarvestDate) : 'Not scheduled'}
          </div>
          {daysToNext !== null && (
            <div style={{ ...s.nextDays, color: daysToNext <= 7 ? '#EF9A9A' : daysToNext <= 14 ? '#FFCC80' : '#4CAF50' }}>
              {daysToNext === 0 ? 'Today!' : daysToNext > 0 ? `in ${daysToNext} days` : `${Math.abs(daysToNext)} days overdue`}
            </div>
          )}
          <div style={s.nextNote}>Target interval: 45 days</div>
        </div>

        {/* Year filter */}
        <div className="month-strip" style={{ marginBottom: '12px' }}>
          <button className={`month-pill${year === 0 ? ' active' : ''}`} onClick={() => setYear(0)}>All</button>
          {YEARS.slice(1).map(y => (
            <button key={y} className={`month-pill${year === y ? ' active' : ''}`} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner"/>Loading...</div>
        ) : (
          <>
            {/* ── HARVEST TABLE ── */}
            <div className="card-section-label">
              HARVEST LOG · {harvests.length} RECORDS
            </div>

            {withDelay.length === 0 ? (
              <div style={s.empty}>No harvests recorded{year !== 0 ? ` for ${year}` : ''}</div>
            ) : withDelay.map((h, i) => {
              const rejPctVal = h.count > 0 ? ((h.rejected / h.count) * 100).toFixed(1) : 0
              const rejHigh   = parseFloat(rejPctVal) > 10
              const delayOk   = h.delay !== null && h.delay >= 40 && h.delay <= 55
              const delayLow  = h.delay !== null && h.delay < 40
              const delayHigh = h.delay !== null && h.delay > 55

              return (
                <div key={i} style={s.harvestCard}>
                  {/* Row 1 — date + delay badge */}
                  <div style={s.cardHeader}>
                    <span style={s.harvestDate}>{fmtDate(h.date)}</span>
                    {h.delay !== null && (
                      <span style={{
                        ...s.delayBadge,
                        background: delayOk ? 'rgba(76,175,80,0.15)' : 'rgba(200,144,58,0.15)',
                        color: delayOk ? '#4CAF50' : delayLow ? '#EF9A9A' : '#FFCC80',
                        borderColor: delayOk ? 'rgba(76,175,80,0.3)' : 'rgba(200,144,58,0.3)',
                      }}>
                        {h.delay}d gap {delayOk ? '✓' : delayLow ? '↓ early' : '↑ late'}
                      </span>
                    )}
                  </div>

                  {/* Row 2 — main metrics grid */}
                  <div style={s.metricGrid}>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>HARVEST #</div>
                      <div style={s.metricVal}>{harvests.length - i}</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>TOTAL NUTS</div>
                      <div style={s.metricVal}>{(h.count || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>REJECTED</div>
                      <div style={{ ...s.metricVal, color: rejHigh ? '#EF9A9A' : '#EDF2F7' }}>
                        {(h.rejected || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>REJ %</div>
                      <div style={{ ...s.metricVal, color: rejHigh ? '#EF9A9A' : '#4CAF50' }}>
                        {rejPct(h.count, h.rejected)}
                      </div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>WEIGHT</div>
                      <div style={s.metricVal}>{h.weight}kg</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>₹/KG</div>
                      <div style={{ ...s.metricVal, color: '#C8903A' }}>₹{h.pricePerKg}</div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>EXPENSES</div>
                      <div style={{ ...s.metricVal, color: '#EF9A9A' }}>
                        ₹{(h.totalExpense || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={s.metric}>
                      <div style={s.metricLabel}>HARVESTER</div>
                      <div style={s.metricVal}>{h.harvester}</div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* ── NUT COUNT TREND ── */}
            <div className="card-section-label" style={{ marginTop: 20 }}>
              TREND — TOTAL COCONUT COUNT BY HARVEST
            </div>
            <div className="card" style={{ padding: '16px 8px' }}>
              <NutTrendChart harvests={harvests} />
            </div>

            {/* ── RATE TREND ── */}
            <div className="card-section-label" style={{ marginTop: 16 }}>
              RATE COMPARISON — ₹/KG (2025 vs 2026)
            </div>
            <div className="card" style={{ padding: '16px 8px' }}>
              <RateTrendChart harvests={harvests} />
              <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:8 }}>
                {Object.entries(
                  harvests.reduce((acc, h) => {
                    if (!acc[h.year]) acc[h.year] = { total:0, count:0 }
                    acc[h.year].total += h.pricePerKg
                    acc[h.year].count += 1
                    return acc
                  }, {})
                ).sort(([a],[b]) => b - a).map(([yr, v]) => (
                  <div key={yr} style={{ textAlign:'center' }}>
                    <div style={{ color:'#5C7080', fontSize:'0.65rem', letterSpacing:'1px' }}>{yr} AVG</div>
                    <div style={{ color:'#C8903A', fontWeight:700, fontSize:'0.9rem' }}>
                      ₹{Math.round(v.total / v.count)}/kg
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  nextBanner: {
    borderRadius: 12,
    border: '1px solid',
    padding: '14px 16px',
    marginBottom: 14,
    textAlign: 'center',
  },
  nextLabel:  { fontSize: '0.6rem', color: '#5C7080', letterSpacing: '2px', marginBottom: 4 },
  nextDate:   { fontSize: '1.05rem', fontWeight: 700, color: '#E8B86D', fontFamily: "'Cormorant Garamond', serif" },
  nextDays:   { fontSize: '0.8rem', fontWeight: 600, marginTop: 4 },
  nextNote:   { fontSize: '0.6rem', color: '#3A4550', marginTop: 4 },

  harvestCard: {
    background: '#1A1F24',
    borderRadius: 10,
    border: '1px solid rgba(200,144,58,0.12)',
    padding: '12px 14px',
    marginBottom: 8,
  },
  cardHeader:  { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 },
  harvestDate: { color: '#C8903A', fontWeight: 700, fontSize: '0.88rem' },
  delayBadge:  { fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 12, border: '1px solid' },

  metricGrid:  { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'10px 6px' },
  metric:      {},
  metricLabel: { fontSize: '0.57rem', color: '#5C7080', letterSpacing: '1px', marginBottom: 2 },
  metricVal:   { fontSize: '0.82rem', fontWeight: 600, color: '#EDF2F7' },

  empty: { color: '#5C7080', textAlign: 'center', padding: '32px', fontSize: '0.85rem' },
}
