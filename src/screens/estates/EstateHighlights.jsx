// ============================================================
//  EstateHighlights.jsx — Operational summary for estate manager
//  Shows: coconut harvest timing, irrigation, fertilization, mango
//  NOT financial — that's owner-only
// ============================================================
import { useState, useEffect } from 'react'
import { api } from '../../api'

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return d }
}
function fmtMon(ym) {
  if (!ym) return '—'
  try { return new Date(ym + '-01').toLocaleDateString('en-IN', { month:'short', year:'numeric' }) }
  catch { return ym }
}

function HighlightCard({ icon, title, color='#C8903A', children, defaultOpen=false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border:`1px solid ${color}30`, borderRadius:'12px', marginBottom:'8px', overflow:'hidden' }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', cursor:'pointer', background: open ? `${color}10` : 'var(--dark-card)' }}>
        <span style={{ fontSize:'1.1rem' }}>{icon}</span>
        <span style={{ fontWeight:'600', fontSize:'0.85rem', color: open ? color : 'var(--text)', flex:1 }}>{title}</span>
        <span style={{ color:'#5C7080', fontSize:'0.9rem' }}>{open ? '∧' : '∨'}</span>
      </div>
      {open && <div style={{ padding:'12px 14px', borderTop:`1px solid ${color}20` }}>{children}</div>}
    </div>
  )
}

export default function EstateHighlights({ estate = 'pollachi' }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getEstateHighlights(estate)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [estate])

  if (loading) return (
    <div style={{ textAlign:'center', color:'#5C7080', padding:'16px', fontSize:'0.8rem' }}>Loading highlights…</div>
  )
  if (!data) return null

  const coconut       = data?.coconut       || { harvestTimings:[], nextScheduled:null, daysToNext:null, totalHarvests:0 }
  const irrigation    = data?.irrigation    || { monthly:[], lastDate:null, daysAgo:null }
  const fertilization = data?.fertilization || { last:null, next:null }
  const mango         = data?.mango         || []

  // Harvest timing summary
  const onTime   = coconut.harvestTimings.filter(h => h.gap !== null && Math.abs(h.gap) <= 7).length
  const late     = coconut.harvestTimings.filter(h => h.gap !== null && h.gap > 7).length
  const early    = coconut.harvestTimings.filter(h => h.gap !== null && h.gap < -7).length

  // Irrigation — build last 12 months grid
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const log = irrigation.monthly?.find(m => m.ym === ym)
    months.push({ ym, count: log?.count || 0 })
  }

  // Fertilization days
  const today = new Date()
  const nextFertDays = fertilization.next?.date
    ? Math.round((new Date(fertilization.next.date) - today) / 86400000)
    : null
  const lastFertDays = fertilization.last?.date
    ? Math.round((today - new Date(fertilization.last.date)) / 86400000)
    : null

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize:'0.62rem', color:'#C8903A', letterSpacing:'2px', marginBottom:'8px' }}>
        LAST 12 MONTHS · HIGHLIGHTS
      </div>

      {/* ── COCONUT HARVEST TIMING ── */}
      <HighlightCard icon="🥥" title="Coconut harvest — planned vs actual" color="#C8903A" defaultOpen={true}>
        <div style={{ display:'flex', gap:'10px', marginBottom:'10px' }}>
          {[
            { label:'On time (±7d)', val: onTime, color:'#34A853' },
            { label:'Late', val: late, color:'#EF4444' },
            { label:'Early', val: early, color:'#185FA5' },
          ].map(s => (
            <div key={s.label} style={{ flex:1, textAlign:'center', background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'8px 4px' }}>
              <div style={{ fontSize:'1.1rem', fontWeight:'700', color: s.color }}>{s.val}</div>
              <div style={{ fontSize:'0.62rem', color:'#5C7080', marginTop:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {coconut.harvestTimings.map((h, i) => {
          const gapColor = h.gap === null ? '#5C7080' : Math.abs(h.gap) <= 7 ? '#34A853' : h.gap > 0 ? '#EF4444' : '#185FA5'
          const gapLabel = h.gap === null ? '—' : h.gap === 0 ? 'On time' : h.gap > 0 ? `${h.gap}d late` : `${Math.abs(h.gap)}d early`
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width:'90px', fontSize:'0.75rem', color:'#EDF2F7', fontWeight:'600' }}>{fmtDate(h.date)}</div>
              <div style={{ flex:1, fontSize:'0.7rem', color:'#5C7080' }}>
                Planned: {fmtDate(h.planned)}
              </div>
              <div style={{ fontSize:'0.75rem', fontWeight:'700', color: gapColor, width:'70px', textAlign:'right' }}>
                {gapLabel}
              </div>
            </div>
          )
        })}
        {coconut.nextScheduled && (
          <div style={{ marginTop:'10px', padding:'8px 10px', background:'rgba(200,144,58,0.08)', borderRadius:'8px', fontSize:'0.78rem' }}>
            <span style={{ color:'#5C7080' }}>Next scheduled: </span>
            <span style={{ color: coconut.daysToNext < 0 ? '#EF4444' : '#C8903A', fontWeight:'700' }}>
              {fmtDate(coconut.nextScheduled)}
              {coconut.daysToNext !== null && ` (${Math.abs(coconut.daysToNext)}d ${coconut.daysToNext < 0 ? 'overdue' : 'away'})`}
            </span>
          </div>
        )}
      </HighlightCard>

      {/* ── IRRIGATION ── */}
      <HighlightCard icon="💧" title="Drip irrigation — monthly activity" color="#185FA5">
        <div style={{ fontSize:'0.68rem', color:'#5C7080', marginBottom:'8px' }}>
          Last logged: {irrigation.lastDate
            ? `${fmtDate(irrigation.lastDate)} (${irrigation.daysAgo}d ago)`
            : 'Never'}
        </div>
        {/* 12-month heatmap grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'4px', marginBottom:'6px' }}>
          {months.map(m => (
            <div key={m.ym} style={{
              textAlign:'center', padding:'4px 2px', borderRadius:'6px',
              background: m.count === 0 ? 'rgba(255,255,255,0.03)' : `rgba(24,95,165,${Math.min(0.9, 0.2 + m.count * 0.25)})`,
              border: `1px solid ${m.count === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(24,95,165,0.4)'}`,
            }}>
              <div style={{ fontSize:'0.58rem', color: m.count > 0 ? '#EDF2F7' : '#5C7080' }}>
                {fmtMon(m.ym).replace(' ', '\n')}
              </div>
              <div style={{ fontSize:'0.72rem', fontWeight:'700', color: m.count > 0 ? '#85B7EB' : '#5C7080' }}>
                {m.count || '—'}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:'0.65rem', color:'#5C7080' }}>Numbers = irrigation events logged that month</div>
      </HighlightCard>

      {/* ── FERTILIZATION ── */}
      <HighlightCard icon="🌱" title="Fertilization schedule" color="#34A853">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
          <div style={{ background:'rgba(52,168,83,0.06)', border:'1px solid rgba(52,168,83,0.2)', borderRadius:'8px', padding:'10px 12px' }}>
            <div style={{ fontSize:'0.62rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'4px' }}>LAST DONE</div>
            <div style={{ fontWeight:'700', color:'#34A853', fontSize:'0.88rem' }}>
              {fertilization.last ? fmtDate(fertilization.last.date) : '—'}
            </div>
            {lastFertDays !== null && (
              <div style={{ fontSize:'0.68rem', color:'#5C7080', marginTop:'2px' }}>{lastFertDays}d ago</div>
            )}
            {fertilization.last?.type && (
              <div style={{ fontSize:'0.68rem', color:'#9AA5B4', marginTop:'2px' }}>{fertilization.last.type}</div>
            )}
          </div>
          <div style={{ background:'rgba(52,168,83,0.06)', border:'1px solid rgba(52,168,83,0.2)', borderRadius:'8px', padding:'10px 12px' }}>
            <div style={{ fontSize:'0.62rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'4px' }}>NEXT PLANNED</div>
            <div style={{ fontWeight:'700', color: nextFertDays !== null && nextFertDays < 0 ? '#EF4444' : '#34A853', fontSize:'0.88rem' }}>
              {fertilization.next ? fmtDate(fertilization.next.date) : '—'}
            </div>
            {nextFertDays !== null && (
              <div style={{ fontSize:'0.68rem', color: nextFertDays < 0 ? '#EF4444' : '#5C7080', marginTop:'2px' }}>
                {nextFertDays < 0 ? `${Math.abs(nextFertDays)}d overdue` : `in ${nextFertDays}d`}
              </div>
            )}
            {fertilization.next?.type && (
              <div style={{ fontSize:'0.68rem', color:'#9AA5B4', marginTop:'2px' }}>{fertilization.next.type}</div>
            )}
          </div>
        </div>
        {fertilization.next?.notes && (
          <div style={{ fontSize:'0.72rem', color:'#9AA5B4', background:'rgba(255,255,255,0.03)', padding:'6px 10px', borderRadius:'6px' }}>
            {fertilization.next.notes}
          </div>
        )}
      </HighlightCard>

      {/* ── MANGO HARVEST ── */}
      <HighlightCard icon="🥭" title="Mango harvest — year on year" color="#F59E0B">
        {mango.length === 0 ? (
          <div style={{ textAlign:'center', color:'#5C7080', fontSize:'0.8rem', padding:'12px' }}>
            No mango harvest data yet.<br/>
            <span style={{ fontSize:'0.72rem' }}>Add via Income / Expense → Mango Harvest Income</span>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
              {mango.slice(0, 2).map(m => (
                <div key={m.harvest_year} style={{ flex:1, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'8px', padding:'10px 12px' }}>
                  <div style={{ fontSize:'0.62rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'4px' }}>{m.harvest_year}</div>
                  <div style={{ fontWeight:'700', color:'#F59E0B', fontSize:'1rem' }}>
                    {m.tons > 0 ? `${m.tons}T` : m.units > 0 ? `${m.units} units` : '—'}
                  </div>
                  {m.revenue > 0 && (
                    <div style={{ fontSize:'0.7rem', color:'#9AA5B4', marginTop:'2px' }}>
                      ₹{m.revenue >= 1000 ? (m.revenue/1000).toFixed(1)+'K' : m.revenue}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {mango.length >= 2 && (() => {
              const curr = mango[0], prev = mango[1]
              const metric = curr.tons > 0 ? 'tons' : 'units'
              const currVal = curr[metric], prevVal = prev[metric]
              const diff = prevVal > 0 ? Math.round(((currVal - prevVal) / prevVal) * 100) : null
              return diff !== null ? (
                <div style={{ fontSize:'0.75rem', color: diff >= 0 ? '#34A853' : '#EF4444', background: diff >= 0 ? 'rgba(52,168,83,0.06)' : 'rgba(239,68,68,0.06)', padding:'6px 10px', borderRadius:'6px', fontWeight:'600' }}>
                  {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}% vs {prev.harvest_year}
                </div>
              ) : null
            })()}
          </>
        )}
      </HighlightCard>
    </div>
  )
}
