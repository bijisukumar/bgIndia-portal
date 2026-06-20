import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { parseLocalDate } from '../utils/dates'

// ── COMMISSION LOGIC ──────────────────────────────────────────────────────────
// To change Raman's commission rates, edit ONLY this function.
// Do NOT display these figures in the UI — Raman doesn't need to see the formula.
//
// Current rates (owner confirmed May 2026, based on master Excel formula since 2018):
//   1-night stay  → ₹1,000
//   2+ night stay → ₹2,000
//
function calcCommission(nights) {
  if (nights <= 1) return 1000
  return 2000
}
// ─────────────────────────────────────────────────────────────────────────────

function StarRating({ rating }) {
  if (!rating || rating === 0) return null
  const isBad = rating < 5
  return (
    <span style={{
      color: isBad ? '#E05C5C' : '#C8903A',
      fontSize: '0.72rem',
      fontWeight: 700,
      marginLeft: 6,
      letterSpacing: '-0.5px',
    }}>
      {'★'.repeat(Math.floor(rating))}{rating % 1 >= 0.5 ? '½' : ''}
      {isBad && <span style={{ fontSize: '0.6rem', marginLeft: 2 }}>{rating.toFixed(1)}</span>}
    </span>
  )
}

const CUR_YEAR = new Date().getFullYear()

function fmt(n) {
  if (!n && n !== 0) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}
function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(d) }
}
function Skeleton({ h = 60 }) {
  return <div style={{ height: h, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', marginBottom: '10px' }} />
}

export default function RDashboard() {
  const navigate = useNavigate()
  const [tab, setTab]           = useState('unpaid')
  const [unpaid, setUnpaid]     = useState(null)
  const [report, setReport]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [paying, setPaying]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [apiError, setApiError] = useState(null)
  const [expandQ, setExpandQ]   = useState({})
  const [expandYear, setExpandYear]   = useState({})
  const [expandMonth, setExpandMonth] = useState({})
  // Set of stay_ids (comm_ids) selected via checkboxes
  const [selected, setSelected] = useState(new Set())

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }

  const loadData = () => {
    setLoading(true)
    setApiError(null)
    Promise.all([
      api.getRamanUnpaid(),
      api.getRamanReport(),
    ]).then(([u, r]) => {
      setUnpaid(u)
      setReport(r)
      setLoading(false)
    }).catch((e) => {
      console.error('RDashboard load error:', e)
      setApiError(e.message || 'Failed to connect to database')
      setLoading(false)
    })
  }

  useEffect(() => { loadData() }, [])

  // ── SELECTION HELPERS ────────────────────────────────────────────────────
  const toggleOne = (commId) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(commId) ? next.delete(commId) : next.add(commId)
      return next
    })
  }

  const toggleAll = () => {
    const allIds = getAllStays().map(s => s.commId)
    setSelected(prev =>
      prev.size === allIds.length ? new Set() : new Set(allIds)
    )
  }

  const toggleQuarter = (qLabel) => {
    const qStays = getQuarterStays(qLabel)
    const ids = qStays.map(s => s.commId)
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => next.has(id))
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const getAllStays = () =>
    (unpaid?.quarters || []).flatMap(q => q.stays || [])

  const getQuarterStays = (qLabel) =>
    (unpaid?.quarters || []).find(q => q.label === qLabel)?.stays || []

  // ── PAY SELECTED ─────────────────────────────────────────────────────────
  const handleMarkSelected = async () => {
    if (selected.size === 0) { showToast('Select at least one stay first', 'error'); return }
    setPaying(true)
    const today = new Date().toISOString().substring(0, 10)
    try {
      // Send selected comm_ids to backend
      await api.markRamanPaid({ commIds: [...selected], paidDate: today })
      const total = getAllStays()
        .filter(s => selected.has(s.commId))
        .reduce((sum, s) => sum + calcCommission(s.nights), 0)
      showToast(`✅ ${fmt(total)} marked paid for ${selected.size} stay${selected.size > 1 ? 's' : ''}`)
      setSelected(new Set())
      loadData()
    } catch (e) {
      showToast('Failed to mark as paid. Try again.', 'error')
    } finally {
      setPaying(false)
    }
  }

  // ── PAY WHOLE QUARTER ────────────────────────────────────────────────────
  const handleMarkQuarterPaid = async (qLabel) => {
    setPaying(true)
    const today = new Date().toISOString().substring(0, 10)
    try {
      await api.markRamanPaid({ quarter: qLabel, paidDate: today })
      const q = unpaid?.quarters?.find(q => q.label === qLabel)
      showToast(`✅ ${fmt(q?.total)} marked paid for ${qLabel}`)
      setSelected(new Set())
      loadData()
    } catch {
      showToast('Failed. Try again.', 'error')
    } finally {
      setPaying(false)
    }
  }

  // ── PAY ALL ──────────────────────────────────────────────────────────────
  const handleMarkAllPaid = async () => {
    setPaying(true)
    const today = new Date().toISOString().substring(0, 10)
    try {
      await api.markRamanPaid({ paidDate: today })
      showToast(`✅ ${fmt(unpaid?.totalUnpaid)} — all unpaid stays marked paid`)
      setSelected(new Set())
      loadData()
    } catch {
      showToast('Failed. Try again.', 'error')
    } finally {
      setPaying(false)
    }
  }

  const gpayLink = (amount) => {
    const upi = '85471419raman@okicici'
    return `upi://pay?pa=${upi}&pn=RamananKutty&am=${amount}&cu=INR&tn=Villa+Commission`
  }

  const allStays = getAllStays()
  const allIds = allStays.map(s => s.commId)
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someChecked = selected.size > 0 && !allChecked

  // Total of selected stays using our commission calc
  const selectedTotal = allStays
    .filter(s => selected.has(s.commId))
    .reduce((sum, s) => sum + calcCommission(s.nights), 0)

  const TABS = [
    { key: 'unpaid',  label: 'Unpaid',  icon: '⏳' },
    { key: 'history', label: 'History', icon: '📋' },
  ]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">R-Dashboard</div>
          <div className="topbar-sub">RAMANKUTTY · COMMISSION TRACKER</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'var(--dark-card)', borderBottom: '1px solid var(--border-dim)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '12px 4px', border: 'none', background: 'transparent', cursor: 'pointer',
              color: tab === t.key ? 'var(--gold)' : 'var(--text-dim)',
              borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              fontSize: '0.78rem', fontWeight: tab === t.key ? '700' : '400', letterSpacing: '0.5px' }}>
            <div style={{ fontSize: '1rem', marginBottom: '2px' }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      <div className="screen-body">

        {/* API error */}
        {apiError && (
          <div style={{ background: 'rgba(198,40,40,0.12)', border: '1px solid rgba(198,40,40,0.4)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ color: '#EF9A9A', fontWeight: '700', fontSize: '0.82rem', marginBottom: '4px' }}>
              {apiError.includes('401') ? '🔒 Session expired' : '⚠️ Could not load data'}
            </div>
            <div style={{ color: '#EF9A9A', fontSize: '0.75rem' }}>
              {apiError.includes('401')
                ? 'Your session has expired. Please sign off and log in again.'
                : apiError}
            </div>
          </div>
        )}

        {/* ── UNPAID TAB ──────────────────────────────────────────────────── */}
        {tab === 'unpaid' && (
          <>
            {/* Summary card */}
            <div className="card-section-label">TOTAL OUTSTANDING</div>
            {loading ? <Skeleton h={80} /> : (
              <div style={{ background: 'rgba(200,144,58,0.06)', border: '1px solid rgba(200,144,58,0.25)', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', letterSpacing: '1px', marginBottom: '4px' }}>
                      TOTAL UNPAID · {unpaid?.unpaidCount || 0} STAYS
                    </div>
                    <div style={{ color: 'var(--gold)', fontSize: '2rem', fontWeight: '800', fontFamily: 'monospace' }}>
                      {fmt(unpaid?.totalUnpaid)}
                    </div>
                  </div>
                </div>

                {/* Bulk action buttons */}
                {(unpaid?.totalUnpaid > 0) && (
                  <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                    {selected.size > 0 ? (
                      <>
                        <button onClick={handleMarkSelected} disabled={paying}
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                          {paying ? 'Marking...' : `Pay ${selected.size} selected → ${fmt(selectedTotal)}`}
                        </button>
                        <button onClick={() => setSelected(new Set())}
                          style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(200,144,58,0.3)', background: 'transparent', color: 'var(--gold)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>
                          Clear
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={handleMarkAllPaid} disabled={paying}
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                          {paying ? 'Marking...' : `Mark all paid → ${fmt(unpaid?.totalUnpaid)}`}
                        </button>
                        <a href={gpayLink(unpaid?.totalUnpaid || 0)}
                          style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(200,144,58,0.3)', background: 'transparent', color: 'var(--gold)', fontSize: '0.85rem', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          💳 GPay
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Select-all checkbox */}
            {!loading && allStays.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 2px', marginBottom: '4px' }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked }}
                  onChange={toggleAll}
                  style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                  {allChecked ? 'Deselect all' : `Select all (${allStays.length} stays)`}
                </span>
              </div>
            )}

            {/* Quarters */}
            <div className="card-section-label">BY QUARTER</div>
            {loading ? (
              <><Skeleton /><Skeleton /><Skeleton /></>
            ) : !unpaid?.quarters?.length ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--green)', padding: '24px' }}>
                ✅ All stays paid — nothing outstanding
              </div>
            ) : (
              unpaid.quarters.map((q, qi) => {
                const qStays = q.stays || []
                const qIds = qStays.map(s => s.commId)
                const qAllChecked = qIds.length > 0 && qIds.every(id => selected.has(id))
                const qSomeChecked = qIds.some(id => selected.has(id)) && !qAllChecked

                return (
                  <div key={qi} style={{ background: 'var(--dark-card)', border: '1px solid var(--border-dim)', borderRadius: '12px', marginBottom: '8px', overflow: 'hidden' }}>

                    {/* Quarter header with checkbox */}
                    <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandQ[q.label] ? '1px solid var(--border-dim)' : 'none' }}
                      onClick={() => setExpandQ(prev => ({ ...prev, [q.label]: !prev[q.label] }))}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={qAllChecked}
                          ref={el => { if (el) el.indeterminate = qSomeChecked }}
                          onChange={(e) => { e.stopPropagation(); toggleQuarter(q.label) }}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ color: 'var(--text)', fontWeight: '700', fontSize: '0.95rem' }}>{q.label}</div>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '2px' }}>
                            {qStays.length} stay{qStays.length !== 1 ? 's' : ''} · {expandQ[q.label] ? 'tap to collapse' : 'tap to expand'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--gold)', fontWeight: '800', fontSize: '1.1rem' }}>{fmt(q.total)}</div>
                      </div>
                    </div>

                    {/* Expanded: stay list with per-stay checkboxes */}
                    {expandQ[q.label] && (
                      <>
                        {qStays.map((s, si) => {
                          const isChecked = selected.has(s.commId)
                          return (
                            <div key={si}
                              onClick={() => toggleOne(s.commId)}
                              style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: isChecked ? 'rgba(200,144,58,0.07)' : 'transparent', transition: 'background 0.12s', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleOne(s.commId)}
                                onClick={e => e.stopPropagation()}
                                style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {s.guestName || s.bookerName}
                                  <StarRating rating={s.reviewRating} />
                                </div>
                                <div style={{ color: 'var(--text-dim)', fontSize: '0.73rem', marginTop: '1px' }}>
                                  {fmtDate(s.checkIn)} · {s.nights} night{s.nights > 1 ? 's' : ''}
                                </div>
                              </div>
                              <div style={{ color: 'var(--gold)', fontWeight: '700', fontSize: '0.9rem', flexShrink: 0 }}>
                                {fmt(calcCommission(s.nights))}
                              </div>
                            </div>
                          )
                        })}

                        {/* Pay this quarter button */}
                        <div style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleMarkQuarterPaid(q.label)} disabled={paying}
                            style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid rgba(200,144,58,0.3)', background: 'rgba(200,144,58,0.15)', color: 'var(--gold)', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}>
                            {paying ? 'Marking...' : `Mark ${q.label} paid → ${fmt(q.total)}`}
                          </button>
                          <a href={gpayLink(q.total || 0)}
                            style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid rgba(200,144,58,0.2)', color: 'var(--gold)', fontSize: '0.82rem', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            💳
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {/* ── HISTORY TAB — year/month report ─────────────────────────────── */}
        {tab === 'history' && (
          <>
            {/* Missed guests banner — checked-out stays with no commission row at all */}
            {!loading && report?.missedGuests?.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ color: '#EF4444', fontWeight: '700', fontSize: '0.85rem', marginBottom: '8px' }}>
                  ⚠️ {report.missedGuests.length} checked-out guest{report.missedGuests.length !== 1 ? 's' : ''} missing from commission tracking
                </div>
                <div style={{ color: '#FCA5A5', fontSize: '0.74rem', marginBottom: '8px' }}>
                  These stays were checked out but never got a commission record. Review and add manually if needed.
                </div>
                {report.missedGuests.map((g, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: '#FCA5A5', padding: '4px 0',
                    borderTop: i > 0 ? '1px solid rgba(239,68,68,0.15)' : 'none' }}>
                    {g.guestName} · {fmtDate(g.checkIn)} · {g.nights} night{g.nights !== 1 ? 's' : ''}
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="card-section-label">ALL-TIME SUMMARY</div>
            {loading ? <Skeleton h={80} /> : (
              <div style={{ background: 'rgba(52,168,83,0.06)', border: '1px solid rgba(52,168,83,0.2)', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', letterSpacing: '1px', marginBottom: '4px' }}>
                      TOTAL GUESTS TRACKED
                    </div>
                    <div style={{ color: 'var(--text)', fontSize: '1.6rem', fontWeight: '800' }}>
                      {report?.totalGuestsAllTime || 0}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', letterSpacing: '1px', marginBottom: '4px' }}>
                      PAID TO DATE
                    </div>
                    <div style={{ color: 'var(--green)', fontSize: '1.6rem', fontWeight: '800', fontFamily: 'monospace' }}>
                      {fmt(report?.grandTotalPaid)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Year -> Month tree */}
            <div className="card-section-label">BY YEAR &amp; MONTH</div>
            {loading ? (
              <><Skeleton /><Skeleton /><Skeleton /></>
            ) : !report?.years?.length ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '24px' }}>
                No commission history yet
              </div>
            ) : (
              report.years.map((y) => {
                const yOpen = expandYear[y.year] !== false // default open for most-recent; toggled per year
                return (
                  <div key={y.year} style={{ marginBottom: '10px', background: 'var(--dark-card)',
                    border: '1px solid var(--border-dim)', borderRadius: '12px', overflow: 'hidden' }}>

                    {/* Year header */}
                    <div onClick={() => setExpandYear(prev => ({ ...prev, [y.year]: !yOpen }))}
                      style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', cursor: 'pointer',
                        borderBottom: yOpen ? '1px solid var(--border-dim)' : 'none' }}>
                      <div>
                        <div style={{ color: 'var(--gold)', fontWeight: '800', fontSize: '1rem' }}>{y.year}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.74rem', marginTop: '2px' }}>
                          {y.totalGuests} guest{y.totalGuests !== 1 ? 's' : ''}
                          {y.totalUnpaid > 0 && <span style={{ color: '#e67e22' }}> · {fmt(y.totalUnpaid)} unpaid</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--green)', fontWeight: '700', fontSize: '0.92rem' }}>{fmt(y.totalPaid)}</span>
                        <span style={{ color: 'var(--text-dim)' }}>{yOpen ? '▼' : '▶'}</span>
                      </div>
                    </div>

                    {/* Months */}
                    {yOpen && y.months.map((m) => {
                      const mKey = m.key
                      const mOpen = !!expandMonth[mKey]
                      return (
                        <div key={mKey}>
                          <div onClick={() => setExpandMonth(prev => ({ ...prev, [mKey]: !mOpen }))}
                            style={{ padding: '10px 16px 10px 24px', display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{mOpen ? '▾' : '▸'}</span>
                              <span style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: '600' }}>{m.monthName}</span>
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                                · {m.paidCount + m.unpaidCount} guest{(m.paidCount + m.unpaidCount) !== 1 ? 's' : ''}
                                {m.unpaidCount > 0 && <span style={{ color: '#e67e22' }}> ({m.unpaidCount} unpaid)</span>}
                              </span>
                            </div>
                            <span style={{ color: 'var(--green)', fontSize: '0.82rem', fontWeight: '700' }}>{fmt(m.totalPaid)}</span>
                          </div>
                          {mOpen && m.guests.map((g, gi) => (
                            <div key={gi} style={{ padding: '8px 16px 8px 40px',
                              borderBottom: gi < m.guests.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{g.guestName}</div>
                                <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: '1px' }}>
                                  {fmtDate(g.checkIn)} · {g.nights} night{g.nights !== 1 ? 's' : ''}
                                </div>
                              </div>
                              <span style={{ fontSize: '0.78rem', fontWeight: '600',
                                color: g.isPaid ? 'var(--green)' : '#e67e22' }}>
                                {g.isPaid ? `✓ ${fmt(g.commission)}` : `⏳ ${fmt(g.commission)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}

            <div className="card-section-label">STATS</div>
            <div className="card">
              {loading ? <Skeleton /> : (
                <>
                  <div className="net-row">
                    <span className="net-label">Total paid to date</span>
                    <span style={{ color: 'var(--green)', fontWeight: '700' }}>{fmt(report?.grandTotalPaid)}</span>
                  </div>
                  <div className="net-row">
                    <span className="net-label">Total outstanding</span>
                    <span style={{ color: 'var(--gold)', fontWeight: '700' }}>{fmt(unpaid?.totalUnpaid)}</span>
                  </div>
                  <div className="net-row">
                    <span className="net-label">All-time commission</span>
                    <span style={{ fontWeight: '700' }}>{fmt((report?.grandTotalPaid || 0) + (unpaid?.totalUnpaid || 0))}</span>
                  </div>
                  <div className="net-row">
                    <span className="net-label">Total guests tracked</span>
                    <span>{report?.totalGuestsAllTime || 0}</span>
                  </div>
                  {report?.missedGuests?.length > 0 && (
                    <div className="net-row">
                      <span className="net-label" style={{ color: '#EF4444' }}>Missing from tracking</span>
                      <span style={{ color: '#EF4444', fontWeight: '700' }}>{report.missedGuests.length}</span>
                    </div>
                  )}
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
