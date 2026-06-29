// ============================================================
//  RentalProperties.jsx — v2: real ledger-backed tracker
//
//  TRACKER TAB rebuilt around rent_transactions instead of the old
//  free-text rental_income fields (per explicit decision, 2026-06-27):
//    - Income side: one real month at a time (not a bulk multi-month
//      range -- a real ledger posting needs a real payment date, so
//      "save the same amount across 6 months" doesn't make sense
//      anymore). Pre-populated from the property's saved agreement
//      (agreed_rent/maintenance_fee/currency), with a single
//      [Paid on Time] button and a [Paid with Fee] exception path
//      that adds a late-fee field -- same UX pattern as the
//      Quick-Post component on the Tenant Agreement screen.
//    - Expenses block: kept exactly as before (free-text fields,
//      multi-field grid) -- per explicit decision, this is for
//      vacant-property costs/taxes, not tied to a tenant or a strict
//      ledger, so the old flexible entry style still fits. Now saves
//      to property_expenses instead of rental_income.
//
//  DASHBOARD TAB and renewal alerts are UNCHANGED -- the backend
//  queries they call (getRentalDashboard) were rewritten to read
//  from the new tables but kept the exact same output shape, so no
//  frontend change was needed there.
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { localTodayStr } from '../../utils/dates'
import MaintenanceEventsLog from './MaintenanceEventsLog'
import { usePropertyList } from './usePropertyList'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CUR_MONTH = new Date().getMonth()
const CUR_YEAR  = new Date().getFullYear()
const YEAR_OPTIONS = [CUR_YEAR, CUR_YEAR - 1]

const EXPENSE_FIELDS = [
  { key: 'electricity',      label: 'Electricity'      },
  { key: 'water',            label: 'Water'            },
  { key: 'propertyTax',      label: 'Property tax'     },
  { key: 'landTax',          label: 'Land tax'         },
]

function emptyExpense() { return Object.fromEntries(EXPENSE_FIELDS.map(f => [f.key, '0'])) }
function calcExpenseTotal(e) { return EXPENSE_FIELDS.reduce((s,f) => s + (parseFloat(e[f.key])||0), 0) }
function fmt(n, currency='INR') {
  if (n === undefined || n === null) return '—'
  const abs = Math.abs(n)
  const symbol = currency === 'USD' ? '$' : '₹'
  const s = abs >= 100000 && currency !== 'USD' ? `${symbol}${(abs/100000).toFixed(1)}L` : abs >= 1000 ? `${symbol}${(abs/1000).toFixed(1)}K` : `${symbol}${abs.toLocaleString('en-IN')}`
  return n < 0 ? `−${s}` : s
}
function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000*60*60*24))
}
function periodMonthStr(year, monthIdx) { return `${year}-${String(monthIdx+1).padStart(2,'0')}` }

export default function RentalProperties() {
  const navigate = useNavigate()
  const { properties, loading: loadingProperties, reload: reloadProperties } = usePropertyList()
  const [tab, setTab] = useState('tracker')
  const [trackerCountry, setTrackerCountry] = useState('IN') // shared by Rent + Expenses sections
  const [selectedMonth, setSelectedMonth] = useState(CUR_MONTH) // Rent only
  const [selectedYear, setSelectedYear] = useState(CUR_YEAR)
  const [expenseMonth, setExpenseMonth] = useState(CUR_MONTH) // separate from Rent's month, per explicit decision -- Expenses gets its own control
  const [expenseYear, setExpenseYear] = useState(CUR_YEAR)
  const [toast, setToast] = useState(null)

  const [agreements, setAgreements] = useState({})
  const [loadingAgreements, setLoadingAgreements] = useState(true)
  const [postedThisMonth, setPostedThisMonth] = useState({}) // propId -> rent_transactions row, for the selected period
  const [checkingPosted, setCheckingPosted] = useState(true)
  const [posting, setPosting] = useState(null) // propId currently posting, or null
  const [exceptionOpenFor, setExceptionOpenFor] = useState(null) // propId with the late-fee drawer open
  const [lateFeeInputs, setLateFeeInputs] = useState({})
  const [paidDateInputs, setPaidDateInputs] = useState({})

  // Initialized empty rather than from CONFIG.rentalProperties (the
  // static array that caused properties to vanish on reload, see
  // usePropertyList.js) -- populated once the live property list
  // loads, in the effect below.
  const [expenses, setExpenses] = useState({})
  const [maintenanceTotals, setMaintenanceTotals] = useState({}) // propId -> sum of this month's logged maintenance events
  const [savingExpenses, setSavingExpenses] = useState(false)

  // Fill in any property that doesn't have an expenses entry yet
  // (newly loaded, or a property added after this screen first
  // rendered) without clobbering whatever's already been typed into
  // an existing one.
  useEffect(() => {
    setExpenses(prev => {
      const next = { ...prev }
      let changed = false
      properties.forEach(p => { if (!next[p.id]) { next[p.id] = emptyExpense(); changed = true } })
      return changed ? next : prev
    })
  }, [properties])

  const [dashData, setDashData]   = useState(null)
  const [dashCountry, setDashCountry] = useState('IN')
  const [dashLoading, setDashLoading] = useState(false)
  const [dashError, setDashError] = useState(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }

  useEffect(() => { loadAgreements() }, [])
  useEffect(() => { checkPostedForPeriod() }, [selectedMonth, selectedYear, agreements, properties])

  async function loadAgreements() {
    setLoadingAgreements(true)
    try {
      const data = await api.getRentalAgreements()
      const map = {}
      ;(Array.isArray(data) ? data : []).forEach(a => { map[a.prop_id] = a })
      setAgreements(map)
    } catch (e) { console.warn(e) }
    finally { setLoadingAgreements(false) }
  }

  async function checkPostedForPeriod() {
    const period = periodMonthStr(selectedYear, selectedMonth)
    setCheckingPosted(true)
    try {
      const results = {}
      await Promise.all(properties.map(async prop => {
        try {
          const txns = await api.getRentTransactions(prop.id)
          const match = (Array.isArray(txns) ? txns : []).find(t => t.period_month === period)
          if (match) results[prop.id] = match
        } catch (e) { /* ignore per-property failure, just means unknown/not-posted */ }
      }))
      setPostedThisMonth(results)
    } finally { setCheckingPosted(false) }
  }

  async function handlePostOnTime(prop) {
    const a = agreements[prop.id]
    if (!a) { showToast(`No saved agreement for ${prop.name} yet — fill in rent/maintenance on the Agreements tab first`, 'error'); return }
    setPosting(prop.id)
    try {
      const period = periodMonthStr(selectedYear, selectedMonth)
      await api.postRentPayment({
        propId: prop.id, periodMonth: period,
        baseRent: a.agreed_rent || 0, maintenance: a.maintenance_fee || 0,
        lateFee: 0, isException: false,
        paidDate: paidDateInputs[prop.id] || localTodayStr(), currency: a.currency || 'INR',
      })
      showToast(`✓ Posted ${MONTHS[selectedMonth]} ${selectedYear} for ${prop.name}`)
      checkPostedForPeriod()
    } catch (e) { showToast(e.message, 'error') }
    finally { setPosting(null) }
  }

  async function handlePostWithFee(prop) {
    const a = agreements[prop.id]
    if (!a) { showToast(`No saved agreement for ${prop.name} yet`, 'error'); return }
    const lateFee = parseFloat(lateFeeInputs[prop.id]) || 0
    const paidDate = paidDateInputs[prop.id] || localTodayStr()
    setPosting(prop.id)
    try {
      const period = periodMonthStr(selectedYear, selectedMonth)
      await api.postRentPayment({
        propId: prop.id, periodMonth: period,
        baseRent: a.agreed_rent || 0, maintenance: a.maintenance_fee || 0,
        lateFee, isException: true,
        paidDate, currency: a.currency || 'INR',
      })
      showToast(`✓ Posted ${MONTHS[selectedMonth]} ${selectedYear} for ${prop.name} (with late fee)`)
      setExceptionOpenFor(null)
      checkPostedForPeriod()
    } catch (e) { showToast(e.message, 'error') }
    finally { setPosting(null) }
  }

  function setExpenseField(propId, key, val) {
    setExpenses(e => ({...e, [propId]: {...e[propId], [key]: val}}))
  }

  async function handleSaveExpenses() {
    setSavingExpenses(true)
    try {
      const targetProps = properties.filter(p => (p.country || 'IN') === trackerCountry)
      await Promise.all(targetProps.map(prop => {
        const e = expenses[prop.id] || emptyExpense()
        return api.savePropertyExpense({
          propId: prop.id, month: expenseMonth + 1, year: expenseYear,
          electricity: e.electricity, water: e.water, propertyTax: e.propertyTax,
          landTax: e.landTax,
        })
      }))
      showToast(`✓ Expenses saved for ${MONTHS[expenseMonth]} ${expenseYear}`)
    } catch (e) { showToast('Failed to save expenses', 'error') }
    finally { setSavingExpenses(false) }
  }

  useEffect(() => {
    if (tab === 'dashboard' && !dashData) {
      setDashLoading(true)
      setDashError(null)
      api.getRentalDashboard(CUR_YEAR)
        .then(d => { setDashData(d); setDashLoading(false) })
        .catch(e => {
          console.error('getRentalDashboard failed:', e)
          setDashError(e?.message || 'Failed to load dashboard data')
          setDashLoading(false)
        })
    }
  }, [tab])

  const renewals = properties
    .map((p) => {
      const a = agreements[p.id]
      const leaseEnd = a?.lease_end
      const isM2M = !!a?.is_month_to_month
      return { ...p, tenantName: a?.tenant_name, days: (leaseEnd && !isM2M) ? daysUntil(leaseEnd) : null }
    })
    .filter(p => p.days !== null && p.days <= 60)

  const tabStyle = (t) => ({
    flex:1, padding:'10px 4px', border:'none', cursor:'pointer',
    fontSize:'0.78rem', fontWeight:'600', letterSpacing:'0.3px', textAlign:'center',
    background: tab===t ? 'rgba(200,144,58,0.1)' : 'transparent',
    color: tab===t ? '#C8903A' : '#5C7080',
    borderBottom: tab===t ? '2px solid #C8903A' : '2px solid transparent',
  })

  const trackerProps = properties.filter(p => (p.country || 'IN') === trackerCountry)
  const trackerCurrency = trackerCountry === 'US' ? 'USD' : 'INR'
  const totalExpenseAll = trackerProps.reduce((s,p) => s + calcExpenseTotal(expenses[p.id] || emptyExpense()) + (maintenanceTotals[p.id] || 0), 0)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Rental properties</div>
          <div className="topbar-sub">MONTHLY TRACKER · {selectedYear}</div>
        </div>
      </div>

      <div style={{display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#111'}}>
        <button style={tabStyle('tracker')}    onClick={()=>setTab('tracker')}>📋 Monthly entry</button>
        <button style={tabStyle('dashboard')}  onClick={()=>setTab('dashboard')}>📊 Dashboard</button>
        <button style={tabStyle('agreements')} onClick={()=>navigate('/owner/rental/agreement')}>📄 Agreements</button>
      </div>

      <div className="screen-body">

        {renewals.length > 0 && (
          <div style={{background:'rgba(198,40,40,0.1)',border:'1px solid rgba(198,40,40,0.3)',borderRadius:'12px',padding:'12px 14px',marginBottom:'12px'}}>
            <div style={{color:'#EF9A9A',fontWeight:'600',fontSize:'0.82rem',marginBottom:'6px'}}>🔔 Renewal alerts</div>
            {renewals.map(p => (
              <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                <span style={{color:'#EDF2F7',fontSize:'0.82rem'}}>{p.name}</span>
                <span style={{color:p.days<0?'#EF9A9A':'#FFCC80',fontSize:'0.78rem'}}>
                  {p.days<0?`Expired ${Math.abs(p.days)}d ago`:`${p.days}d left`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── TRACKER TAB ──────────────────────────────── */}
        {tab === 'tracker' && (
          <>
            {/* Country toggle — shared by Rent and Expenses below, per
                explicit decision (2026-06-29): keeps India and US
                properties visually grouped rather than interleaved. */}
            <div style={{display:'flex', gap:'8px', marginBottom:'14px'}}>
              {[{key:'IN',label:'🇮🇳 India'},{key:'US',label:'🇺🇸 USA'}].map(c => (
                <button key={c.key} onClick={()=>setTrackerCountry(c.key)} style={{
                  flex:1, padding:'10px', borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontSize:'0.85rem',
                  border: trackerCountry===c.key ? '2px solid #34A853' : '1px solid var(--border-dim)',
                  background: trackerCountry===c.key ? 'rgba(52,168,83,0.12)' : 'var(--dark-card)',
                  color: trackerCountry===c.key ? '#34A853' : 'var(--text-dim)',
                }}>{c.label}</button>
              ))}
            </div>

            {/* Single month/year picker -- replaces the old multi-month
                bulk range, since a real ledger posting needs one real
                payment date per month, not a "same amount × N months"
                shortcut. This controls RENT ONLY, per explicit decision
                -- Expenses has its own separate month control below. */}
            <div className="card-section-label">SELECT MONTH (RENT)</div>
            <div className="card" style={{marginBottom:'14px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <select className="field-input" value={selectedMonth} style={{flex:2}}
                  onChange={e=>setSelectedMonth(parseInt(e.target.value))}>
                  {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
                </select>
                <select className="field-input" value={selectedYear} style={{flex:1}}
                  onChange={e=>setSelectedYear(parseInt(e.target.value))}>
                  {YEAR_OPTIONS.map(yr=><option key={yr} value={yr}>{yr}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:'6px',marginTop:'10px',flexWrap:'wrap'}}>
                <button onClick={()=>{setSelectedMonth(CUR_MONTH); setSelectedYear(CUR_YEAR)}}
                  style={{padding:'4px 10px',borderRadius:'16px',cursor:'pointer',fontSize:'0.72rem',fontWeight:'600',
                    border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#5C7080'}}>
                  This month
                </button>
              </div>
            </div>

            {/* Rent ledger — one Quick-Post per property for the selected period */}
            <div className="card-section-label">RENT — {MONTHS[selectedMonth].toUpperCase()} {selectedYear}</div>
            {(loadingProperties || loadingAgreements || checkingPosted) && (
              <div style={{textAlign:'center', color:'var(--text-dim)', padding:'16px'}}>Loading…</div>
            )}
            {!loadingProperties && !loadingAgreements && !checkingPosted && trackerProps.length === 0 && (
              <div style={{textAlign:'center', color:'var(--text-dim)', padding:'24px', fontSize:'0.85rem'}}>
                No {trackerCountry==='US'?'USA':'India'} properties yet.
              </div>
            )}
            {!loadingProperties && !loadingAgreements && !checkingPosted && trackerProps.map(prop => {
              const a = agreements[prop.id]
              const currency = a?.currency || 'INR'
              const baseRent = a?.agreed_rent || 0
              const maintenance = a?.maintenance_fee || 0
              const total = baseRent + maintenance
              const posted = postedThisMonth[prop.id]
              const isPostingThis = posting === prop.id
              return (
                <div key={prop.id} style={{marginBottom:'14px'}}>
                  <div className="card-section-label" style={{display:'flex',justifyContent:'space-between'}}>
                    <span>{prop.name.toUpperCase()}</span>
                    {a?.tenant_name && <span style={{color:'var(--text-dim)', fontWeight:'400', fontSize:'0.72rem'}}>{a.tenant_name}</span>}
                  </div>
                  <div className="card">
                    {!a ? (
                      <div style={{color:'#5C7080', fontSize:'0.8rem'}}>
                        No saved agreement yet — fill in rent on the Agreements tab first.
                      </div>
                    ) : posted ? (
                      <div style={{
                        padding:'12px', borderRadius:'10px', background:'rgba(52,168,83,0.12)',
                        border:'1px solid rgba(52,168,83,0.4)', color:'#34A853',
                      }}>
                        <div style={{fontWeight:'700', fontSize:'0.88rem'}}>
                          ✓ Posted — {fmt(posted.total_due, posted.currency)}
                          {posted.late_fee > 0 && <span style={{color:'#F59E0B', marginLeft:'8px', fontWeight:'600'}}>(incl. {fmt(posted.late_fee, posted.currency)} late fee)</span>}
                        </div>
                        <div style={{fontSize:'0.72rem', color:'var(--text-dim)', marginTop:'2px'}}>Paid {posted.paid_date}</div>
                      </div>
                    ) : (
                      <>
                        <div style={{display:'flex', gap:'16px', marginBottom:'12px', fontSize:'0.8rem'}}>
                          <div><span style={{color:'var(--text-dim)'}}>Rent: </span><span style={{color:'#34A853', fontWeight:'600'}}>{fmt(baseRent, currency)}</span></div>
                          <div><span style={{color:'var(--text-dim)'}}>Maint: </span><span style={{color:'var(--text)', fontWeight:'600'}}>{fmt(maintenance, currency)}</span></div>
                          <div><span style={{color:'var(--text-dim)'}}>Total: </span><span style={{color:'#C8903A', fontWeight:'700'}}>{fmt(total, currency)}</span></div>
                        </div>

                        <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>PAYMENT DATE</label>
                        <input type="date" value={paidDateInputs[prop.id]||localTodayStr()}
                          onChange={e=>setPaidDateInputs(v=>({...v,[prop.id]:e.target.value}))}
                          className="field-input" style={{width:'100%', marginBottom:'10px'}}/>

                        <button
                          onClick={()=>handlePostOnTime(prop)}
                          disabled={isPostingThis}
                          style={{
                            width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid rgba(52,168,83,0.5)',
                            background: isPostingThis ? 'rgba(52,168,83,0.2)' : '#34A853', color:'#fff',
                            fontWeight:'700', fontSize:'0.85rem', cursor: isPostingThis ? 'default' : 'pointer',
                            opacity: isPostingThis ? 0.7 : 1,
                          }}>
                          {isPostingThis ? 'Posting…' : `✓ Paid on Time — ${fmt(total, currency)}`}
                        </button>

                        <button
                          onClick={()=>setExceptionOpenFor(exceptionOpenFor === prop.id ? null : prop.id)}
                          style={{
                            width:'100%', marginTop:'8px', padding:'9px', borderRadius:'10px',
                            border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)',
                            fontWeight:'600', fontSize:'0.78rem', cursor:'pointer',
                          }}>
                          {exceptionOpenFor === prop.id ? '− Hide' : 'Paid with Late Fee'}
                        </button>

                        {exceptionOpenFor === prop.id && (
                          <div style={{marginTop:'10px', padding:'12px', borderRadius:'10px', background:'var(--dark-input)', border:'1px solid var(--border-dim)'}}>
                            <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>LATE FEE ({currency==='USD'?'$':'₹'})</label>
                            <input type="number" min="0" value={lateFeeInputs[prop.id]||''}
                              onChange={e=>setLateFeeInputs(v=>({...v,[prop.id]:e.target.value}))}
                              placeholder="0" className="field-input" style={{width:'100%'}}/>

                            <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'10px'}}>ACTUAL PAYMENT DATE</label>
                            <input type="date" value={paidDateInputs[prop.id]||localTodayStr()}
                              onChange={e=>setPaidDateInputs(v=>({...v,[prop.id]:e.target.value}))}
                              className="field-input" style={{width:'100%'}}/>

                            <div style={{marginTop:'10px', padding:'8px 10px', borderRadius:'8px', background:'rgba(200,144,58,0.08)', border:'1px solid rgba(200,144,58,0.25)'}}>
                              <span style={{fontSize:'0.7rem', color:'var(--text-dim)'}}>Total due: </span>
                              <span style={{fontSize:'0.9rem', color:'#C8903A', fontWeight:'700'}}>
                                {fmt(total + (parseFloat(lateFeeInputs[prop.id])||0), currency)}
                              </span>
                            </div>

                            <button onClick={()=>handlePostWithFee(prop)} disabled={isPostingThis}
                              style={{
                                width:'100%', marginTop:'10px', padding:'10px', borderRadius:'8px', border:'none',
                                background:'#185FA5', color:'#fff', fontWeight:'700', fontSize:'0.85rem',
                                cursor: isPostingThis ? 'default' : 'pointer', opacity: isPostingThis ? 0.7 : 1,
                              }}>
                              {isPostingThis ? 'Saving…' : 'Save to Ledger'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Expenses block — kept exactly as before (free-text grid),
                per explicit decision: this is for vacant-property costs
                or taxes, not tied to a tenant, so the old flexible entry
                style still fits. Now saves to property_expenses.
                Has its OWN month/year control (expenseMonth/expenseYear),
                separate from Rent's selectedMonth/selectedYear, per
                explicit decision -- the owner plans to backfill past
                expense months independently of whatever month Rent is
                currently showing. */}
            <div className="card-section-label" style={{marginTop:'24px'}}>EXPENSES</div>
            <div className="card" style={{marginBottom:'14px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <select className="field-input" value={expenseMonth} style={{flex:2}}
                  onChange={e=>setExpenseMonth(parseInt(e.target.value))}>
                  {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
                </select>
                <select className="field-input" value={expenseYear} style={{flex:1}}
                  onChange={e=>setExpenseYear(parseInt(e.target.value))}>
                  {YEAR_OPTIONS.map(yr=><option key={yr} value={yr}>{yr}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:'6px',marginTop:'10px',flexWrap:'wrap'}}>
                <button onClick={()=>{setExpenseMonth(CUR_MONTH); setExpenseYear(CUR_YEAR)}}
                  style={{padding:'4px 10px',borderRadius:'16px',cursor:'pointer',fontSize:'0.72rem',fontWeight:'600',
                    border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#5C7080'}}>
                  This month
                </button>
              </div>
            </div>
            <div className="card-section-label">{MONTHS[expenseMonth].toUpperCase()} {expenseYear}</div>
            {trackerProps.map(prop => {
              const e = expenses[prop.id] || emptyExpense()
              const total = calcExpenseTotal(e) + (maintenanceTotals[prop.id] || 0)
              const expCurrency = prop.currency || (trackerCountry === 'US' ? 'USD' : 'INR')
              const expSymbol = expCurrency === 'USD' ? '$' : '₹'
              return (
                <div key={prop.id} style={{marginBottom:'10px'}}>
                  <div className="card-section-label" style={{display:'flex',justifyContent:'space-between'}}>
                    <span>{prop.name.toUpperCase()}</span>
                    <span style={{color:'#EF9A9A',fontWeight:'700'}}>{fmt(total, expCurrency)}</span>
                  </div>
                  <div className="card">
                    <div className="grid-2">
                      {EXPENSE_FIELDS.map(f=>(
                        <div key={f.key} className="field">
                          <label className="field-label">{f.label} ({expSymbol})</label>
                          <input className="field-input" type="number" placeholder="0"
                            style={{color:'#EF9A9A'}} value={e[f.key]}
                            onChange={ev=>setExpenseField(prop.id, f.key, ev.target.value)}/>
                        </div>
                      ))}
                    </div>
                    <MaintenanceEventsLog
                      propId={prop.id}
                      month={expenseMonth + 1}
                      year={expenseYear}
                      currency={expCurrency}
                      onTotalChange={(sum) => setMaintenanceTotals(prev => ({ ...prev, [prop.id]: sum }))}
                    />
                  </div>
                </div>
              )
            })}

            <div className="net-box" style={{marginTop:'8px'}}>
              <div className="net-row">
                <span style={{color:'#EDF2F7',fontWeight:'600',fontSize:'1rem'}}>
                  Total expenses · {MONTHS[expenseMonth]} {expenseYear}
                </span>
                <span className="net-val big neg">{fmt(totalExpenseAll, trackerCurrency)}</span>
              </div>
            </div>

            <button className="btn btn-gold" onClick={handleSaveExpenses} disabled={savingExpenses}>
              {savingExpenses ? 'Saving…' : `Save Expenses for ${MONTHS[expenseMonth]} ${expenseYear} →`}
            </button>
          </>
        )}

        {/* ── DASHBOARD TAB — country-separated, per explicit decision 2026-06-29 ── */}
        {tab === 'dashboard' && (
          dashLoading ? <div className="loading"><div className="spinner"/>Loading...</div> : dashError ? (
            <div style={{
              background:'rgba(198,40,40,0.12)', border:'1px solid rgba(198,40,40,0.4)',
              borderRadius:'10px', padding:'12px 14px', color:'#EF9A9A', fontSize:'0.82rem',
            }}>
              ⚠️ Could not load dashboard data: {dashError}
            </div>
          ) : (() => {
            // dashData.rows has no currency of its own -- joined against
            // `properties` (which has the real country/currency from
            // rental_props) so totals are computed PER COUNTRY rather than
            // blending ₹ and $ together into one meaningless sum. Real bug
            // fixed here: every fmt() call in this section used to omit
            // currency entirely, defaulting to INR -- so a US property's
            // $6,000 YTD income was displayed as "₹6.0K".
            const dashProps = properties.filter(p => (p.country || 'IN') === dashCountry)
            const dashCur = dashCountry === 'US' ? 'USD' : 'INR'
            const dashPropIds = new Set(dashProps.map(p => p.id))
            const countryRows = (dashData?.rows || []).filter(r => dashPropIds.has(r.prop_id))
            const countryTotalIncome  = countryRows.reduce((s,r)=>s+(r.income||0),0)
            const countryTotalExpense = countryRows.reduce((s,r)=>s+(r.expense||0),0)
            const countryNetIncome    = countryTotalIncome - countryTotalExpense
            return (
              <>
                <div style={{display:'flex', gap:'8px', marginBottom:'14px'}}>
                  {[{key:'IN',label:'🇮🇳 India'},{key:'US',label:'🇺🇸 USA'}].map(c => (
                    <button key={c.key} onClick={()=>setDashCountry(c.key)} style={{
                      flex:1, padding:'10px', borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontSize:'0.85rem',
                      border: dashCountry===c.key ? '2px solid #34A853' : '1px solid var(--border-dim)',
                      background: dashCountry===c.key ? 'rgba(52,168,83,0.12)' : 'var(--dark-card)',
                      color: dashCountry===c.key ? '#34A853' : 'var(--text-dim)',
                    }}>{c.label}</button>
                  ))}
                </div>

                <div className="card-section-label">ANNUAL SUMMARY — {CUR_YEAR}</div>
                <div className="stats-grid">
                  <div className="stat-card"><div className="stat-label">Total income</div><div className="stat-val green">{fmt(countryTotalIncome, dashCur)}</div><div className="stat-sub">{dashCountry==='US'?'USA':'India'} properties</div></div>
                  <div className="stat-card"><div className="stat-label">Total expenses</div><div className="stat-val" style={{color:'#EF9A9A'}}>{fmt(countryTotalExpense, dashCur)}</div><div className="stat-sub">{dashCountry==='US'?'USA':'India'} properties</div></div>
                  <div className="stat-card"><div className="stat-label">Net income</div><div className="stat-val green">{fmt(countryNetIncome, dashCur)}</div><div className="stat-sub">After expenses</div></div>
                </div>

                {dashProps.length === 0 && (
                  <div style={{textAlign:'center', color:'var(--text-dim)', padding:'24px', fontSize:'0.85rem'}}>
                    No {dashCountry==='US'?'USA':'India'} properties yet.
                  </div>
                )}

                {dashProps.map((prop,i) => {
                  const rows = (dashData?.rows||[]).filter(r=>r.prop_id===prop.id)
                  const ytdIncome  = rows.reduce((s,r)=>s+(r.income||0),0)
                  const ytdExpense = rows.reduce((s,r)=>s+(r.expense||0),0)
                  const ytdNet     = rows.reduce((s,r)=>s+(r.net||0),0)
                  const monthly    = Array(12).fill(0).map((_,mi)=>{const r=rows.find(r=>r.month===mi+1); return r?.net||0})
                  const maxAbs     = Math.max(...monthly.map(Math.abs), 1)
                  const propCur    = prop.currency || dashCur
                  return (
                    <div key={prop.id}>
                      <div className="card-section-label">{prop.name.toUpperCase()}</div>
                      <div className="card">
                        <div style={{display:'flex',gap:'20px',marginBottom:'12px'}}>
                          <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>YTD INCOME</div><div style={{color:'#34A853',fontWeight:'700'}}>{fmt(ytdIncome, propCur)}</div></div>
                          <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>YTD EXPENSE</div><div style={{color:'#EF9A9A',fontWeight:'700'}}>{fmt(ytdExpense, propCur)}</div></div>
                          <div><div style={{color:'#5C7080',fontSize:'0.68rem'}}>YTD NET</div><div style={{color:ytdNet>=0?'#34A853':'#EF9A9A',fontWeight:'700'}}>{fmt(ytdNet, propCur)}</div></div>
                        </div>
                        <div style={{display:'flex',gap:'3px',alignItems:'flex-end',height:'48px'}}>
                          {monthly.map((net,mi)=>{
                            const h = Math.max(2,(Math.abs(net)/maxAbs)*44)
                            return (
                              <div key={mi} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                                <div style={{width:'100%',height:`${h}px`,background:net>=0?'#0F6E56':'#c62828',borderRadius:'2px',opacity:mi>CUR_MONTH?0.3:0.9}}/>
                                <div style={{color:'#3C5060',fontSize:'6px',marginTop:'2px'}}>{MONTHS[mi][0]}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )
          })()
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
