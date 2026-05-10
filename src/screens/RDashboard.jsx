import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const CUR_YEAR  = new Date().getFullYear()
const YEARS     = [CUR_YEAR, CUR_YEAR-1, CUR_YEAR-2, CUR_YEAR-3, CUR_YEAR-4]
const QUARTERS  = ['Q1','Q2','Q3','Q4']

function fmt(n) {
  if (!n && n !== 0) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}
function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return String(d) }
}

function Skeleton({ h=60 }) {
  return <div style={{ height:h, background:'rgba(255,255,255,0.04)', borderRadius:'10px', marginBottom:'10px' }}/>
}

export default function RDashboard() {
  const navigate   = useNavigate()
  const [tab, setTab]         = useState('unpaid')
  const [unpaid, setUnpaid]   = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying]   = useState(null) // quarter being paid
  const [toast, setToast]     = useState(null)
  const [expandQ, setExpandQ] = useState({})

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getRamanUnpaid(),
      api.getRamanHistory(),
    ]).then(([u, h]) => {
      setUnpaid(u)
      setHistory(Array.isArray(h) ? h : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleMarkPaid = async (quarter) => {
    setPaying(quarter)
    const today = new Date().toISOString().substring(0, 10)
    try {
      const res = await api.markRamanPaid({ quarter, paidDate: today })
      showToast(`✅ ${fmt(res?.totalPaid)} marked paid for ${quarter}`)
      // Refresh data
      const [u, h] = await Promise.all([api.getRamanUnpaid(), api.getRamanHistory()])
      setUnpaid(u)
      setHistory(Array.isArray(h) ? h : [])
    } catch (e) {
      showToast('Failed to mark as paid. Try again.', 'error')
    } finally {
      setPaying(null)
    }
  }

  const handleMarkAllPaid = async () => {
    if (!window.confirm) { /* skip confirm in PWA */ }
    setPaying('ALL')
    const today = new Date().toISOString().substring(0, 10)
    try {
      const res = await api.markRamanPaid({ paidDate: today })
      showToast(`✅ ${fmt(res?.totalPaid)} — all unpaid stays marked paid`)
      const [u, h] = await Promise.all([api.getRamanUnpaid(), api.getRamanHistory()])
      setUnpaid(u)
      setHistory(Array.isArray(h) ? h : [])
    } catch {
      showToast('Failed. Try again.', 'error')
    } finally {
      setPaying(null)
    }
  }

  const gpayLink = (amount) => {
    // GPay UPI deep link — replace with Raman's UPI ID
    const upi = '85471419raman@okicici'
    return `upi://pay?pa=${upi}&pn=RamananKutty&am=${amount}&cu=INR&tn=Villa+Commission`
  }

  const totalHistoryPaid = history.reduce((s, h) => s + (h.total || 0), 0)

  const TABS = [
    { key:'unpaid',  label:'Unpaid',  icon:'⏳' },
    { key:'history', label:'History', icon:'📋' },
  ]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">R-Dashboard</div>
          <div className="topbar-sub">RAMANKUTTY · COMMISSION TRACKER</div>
        </div>
        <div style={{width:34}}/>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', background:'var(--dark-card)', borderBottom:'1px solid var(--border-dim)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex:1, padding:'12px 4px', border:'none', background:'transparent', cursor:'pointer',
              color: tab===t.key ? 'var(--gold)' : 'var(--text-dim)',
              borderBottom: tab===t.key ? '2px solid var(--gold)' : '2px solid transparent',
              fontSize:'0.78rem', fontWeight: tab===t.key ? '700':'400', letterSpacing:'0.5px' }}>
            <div style={{ fontSize:'1rem', marginBottom:'2px' }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      <div className="screen-body">

        {/* ── UNPAID TAB ─────────────────────────────────────── */}
        {tab === 'unpaid' && (
          <>
            {/* Summary card */}
            <div className="card-section-label">TOTAL OUTSTANDING</div>
            {loading ? <Skeleton h={80}/> : (
              <div style={{ background:'rgba(200,144,58,0.06)', border:'1px solid rgba(200,144,58,0.25)',
                borderRadius:'14px', padding:'16px', marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ color:'var(--text-dim)', fontSize:'0.72rem', letterSpacing:'1px', marginBottom:'4px' }}>
                      TOTAL UNPAID · {unpaid?.unpaidCount || 0} STAYS
                    </div>
                    <div style={{ color:'var(--gold)', fontSize:'2rem', fontWeight:'800', fontFamily:'monospace' }}>
                      {fmt(unpaid?.totalUnpaid)}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-dim)', marginBottom:'6px' }}>
                      Commission logic:
                    </div>
                    <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>1 night → ₹1,000</div>
                    <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>2+ nights → ₹2,000</div>
                  </div>
                </div>
                {unpaid?.totalUnpaid > 0 && (
                  <div style={{ marginTop:'14px', display:'flex', gap:'8px' }}>
                    <button onClick={handleMarkAllPaid} disabled={!!paying}
                      style={{ flex:1, padding:'10px', borderRadius:'10px', border:'none',
                        background:'var(--gold)', color:'#000', fontWeight:'700', fontSize:'0.85rem', cursor:'pointer' }}>
                      {paying==='ALL' ? 'Marking...' : `Mark all paid → ${fmt(unpaid?.totalUnpaid)}`}
                    </button>
                    <a href={gpayLink(unpaid?.totalUnpaid || 0)}
                      style={{ padding:'10px 14px', borderRadius:'10px', border:'1px solid rgba(200,144,58,0.3)',
                        background:'transparent', color:'var(--gold)', fontSize:'0.85rem', fontWeight:'600',
                        textDecoration:'none', display:'flex', alignItems:'center', gap:'6px' }}>
                      💳 GPay
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* By quarter */}
            <div className="card-section-label">BY QUARTER</div>
            {loading ? (
              <><Skeleton/><Skeleton/><Skeleton/></>
            ) : !unpaid?.quarters?.length ? (
              <div className="card" style={{ textAlign:'center', color:'var(--green)', padding:'24px' }}>
                ✅ All stays paid — nothing outstanding
              </div>
            ) : (
              unpaid.quarters.map((q, qi) => (
                <div key={qi} style={{ background:'var(--dark-card)', border:'1px solid var(--border-dim)',
                  borderRadius:'12px', marginBottom:'8px', overflow:'hidden' }}>
                  {/* Quarter header */}
                  <div style={{ padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center',
                    cursor:'pointer', borderBottom: expandQ[q.label] ? '1px solid var(--border-dim)' : 'none' }}
                    onClick={() => setExpandQ(prev => ({ ...prev, [q.label]: !prev[q.label] }))}>
                    <div>
                      <div style={{ color:'var(--text)', fontWeight:'700', fontSize:'0.95rem' }}>{q.label}</div>
                      <div style={{ color:'var(--text-dim)', fontSize:'0.75rem', marginTop:'2px' }}>
                        {q.stays?.length || 0} stays · {expandQ[q.label] ? 'tap to collapse' : 'tap to expand'}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:'var(--gold)', fontWeight:'800', fontSize:'1.1rem' }}>{fmt(q.total)}</div>
                    </div>
                  </div>

                  {/* Expanded stay list */}
                  {expandQ[q.label] && (
                    <>
                      {(q.stays || []).map((s, si) => (
                        <div key={si} style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.03)',
                          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <div style={{ color:'var(--text)', fontSize:'0.85rem', fontWeight:'500' }}>
                              {s.guestName || s.bookerName}
                            </div>
                            <div style={{ color:'var(--text-dim)', fontSize:'0.73rem', marginTop:'1px' }}>
                              {fmtDate(s.checkIn)} · {s.nights} night{s.nights>1?'s':''}
                            </div>
                          </div>
                          <div style={{ color:'var(--gold)', fontWeight:'700', fontSize:'0.9rem' }}>
                            {fmt(s.ramanComm)}
                          </div>
                        </div>
                      ))}
                      {/* Pay this quarter */}
                      <div style={{ padding:'12px 16px', display:'flex', gap:'8px' }}>
                        <button onClick={() => handleMarkPaid(q.label)} disabled={!!paying}
                          style={{ flex:1, padding:'9px', borderRadius:'9px', border:'none',
                            background:'rgba(200,144,58,0.15)', color:'var(--gold)', fontWeight:'700',
                            fontSize:'0.82rem', cursor:'pointer', border:'1px solid rgba(200,144,58,0.3)' }}>
                          {paying===q.label ? 'Marking...' : `Mark ${q.label} paid → ${fmt(q.total)}`}
                        </button>
                        <a href={gpayLink(q.total || 0)}
                          style={{ padding:'9px 12px', borderRadius:'9px', border:'1px solid rgba(200,144,58,0.2)',
                            color:'var(--gold)', fontSize:'0.82rem', textDecoration:'none',
                            display:'flex', alignItems:'center' }}>
                          💳
                        </a>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* ── HISTORY TAB ────────────────────────────────────── */}
        {tab === 'history' && (
          <>
            <div className="card-section-label">ALL-TIME PAID</div>
            {loading ? <Skeleton h={80}/> : (
              <div style={{ background:'rgba(52,168,83,0.06)', border:'1px solid rgba(52,168,83,0.2)',
                borderRadius:'14px', padding:'16px', marginBottom:'14px' }}>
                <div style={{ color:'var(--text-dim)', fontSize:'0.72rem', letterSpacing:'1px', marginBottom:'4px' }}>
                  TOTAL PAID TO DATE · {history.length} PAYMENTS
                </div>
                <div style={{ color:'var(--green)', fontSize:'2rem', fontWeight:'800', fontFamily:'monospace' }}>
                  {fmt(totalHistoryPaid)}
                </div>
              </div>
            )}

            <div className="card-section-label">PAYMENT HISTORY</div>
            {loading ? (
              <><Skeleton/><Skeleton/><Skeleton/></>
            ) : !history.length ? (
              <div className="card" style={{ textAlign:'center', color:'var(--text-dim)', padding:'24px' }}>
                No payment history yet
              </div>
            ) : (
              <div style={{ background:'var(--dark-card)', borderRadius:'12px',
                border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'12px' }}>
                {history.map((h, i) => (
                  <div key={i} style={{ padding:'14px 16px',
                    borderBottom: i < history.length-1 ? '1px solid var(--border-dim)' : 'none',
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ color:'var(--text)', fontWeight:'600', fontSize:'0.9rem' }}>
                        Paid {fmtDate(h.date)}
                      </div>
                      <div style={{ color:'var(--text-dim)', fontSize:'0.75rem', marginTop:'2px' }}>
                        {h.stays} stay{h.stays>1?'s':''} covered
                      </div>
                    </div>
                    <div style={{ color:'var(--green)', fontWeight:'700', fontSize:'1rem' }}>
                      {fmt(h.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All-time stats */}
            <div className="card-section-label">STATS</div>
            <div className="card">
              {loading ? <Skeleton/> : (
                <>
                  <div className="net-row">
                    <span className="net-label">Total paid to date</span>
                    <span style={{ color:'var(--green)', fontWeight:'700' }}>{fmt(totalHistoryPaid)}</span>
                  </div>
                  <div className="net-row">
                    <span className="net-label">Total outstanding</span>
                    <span style={{ color:'var(--gold)', fontWeight:'700' }}>{fmt(unpaid?.totalUnpaid)}</span>
                  </div>
                  <div className="net-row">
                    <span className="net-label">All-time commission</span>
                    <span style={{ fontWeight:'700' }}>{fmt((totalHistoryPaid||0) + (unpaid?.totalUnpaid||0))}</span>
                  </div>
                  <div className="net-row">
                    <span className="net-label">Number of payments made</span>
                    <span>{history.length}</span>
                  </div>
                  <div className="net-row">
                    <span className="net-label">Avg per payment</span>
                    <span>{history.length ? fmt(Math.round(totalHistoryPaid / history.length)) : '—'}</span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
