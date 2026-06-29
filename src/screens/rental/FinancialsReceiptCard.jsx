// ============================================================
//  FinancialsReceiptCard.jsx — Module C: Financial Parameters &
//  Advance Receipt Engine
//
//  Three sub-sections:
//   1. Fixed Terms Grid — read-only snapshot of the saved agreement's
//      financial constants (deposit, rent, maintenance, dates).
//   2. Quick-Post Rent Ledger — "Paid on Time" one-click posting vs.
//      the late-fee exception drawer, backed by the new
//      rent_transactions table (see migrate-rent-transactions.sql).
//   3. Deposit receipt — generates a Receipt of Payment for the
//      security deposit from the saved agreement.
//
//  All ledger actions are disabled when readOnly (Prior/archival
//  tenant view) — posting a payment or generating a receipt for a
//  read-only historical record would misrepresent it as a live action.
// ============================================================
import { useState, useEffect } from 'react'
import { api } from '../../api'
import { fmtDate, localTodayStr } from '../../utils/dates'
import { downloadDepositReceipt, downloadRentReceipt } from '../../utils/generateReceipt'
import { generateDepositReceipt, generateRentReceipt } from '../../utils/formatChoice'
import FormatToggle from './FormatToggle'

function fmt(n, currency='INR') {
  if (!n && n !== 0) return '—'
  return currency === 'USD' ? `$${Number(n).toLocaleString()}` : `₹${Number(n).toLocaleString('en-IN')}`
}

function currentPeriodMonth() {
  return localTodayStr().slice(0, 7) // 'YYYY-MM'
}

const F = {
  label: {display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'12px'},
  input: {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'},
}

function TermsGrid({ agreement, currency }) {
  const rows = [
    ['Security Deposit', fmt(agreement?.deposit, currency)],
    ['Rent / Month', fmt(agreement?.agreed_rent, currency)],
    ['Maintenance Fees', fmt(agreement?.maintenance_fee, currency)],
    ['Total Monthly Due', fmt((parseFloat(agreement?.agreed_rent)||0) + (parseFloat(agreement?.maintenance_fee)||0), currency)],
    ['Lease Start', fmtDate(agreement?.lease_start)],
    ['Lease End', fmtDate(agreement?.lease_end)],
    ['Next Renewal Date', agreement?.next_renewal_date ? fmtDate(agreement.next_renewal_date) : '—'],
    ['Early Termination Date', agreement?.early_terminated ? fmtDate(agreement.early_termination_date) : '—'],
  ]
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 16px', marginBottom:'4px'}}>
      {rows.map(([label, val]) => (
        <div key={label}>
          <div style={{fontSize:'0.62rem', color:'var(--text-dim)', letterSpacing:'0.5px', textTransform:'uppercase'}}>{label}</div>
          <div style={{fontSize:'0.88rem', color:'var(--text)', fontWeight:'600', marginTop:'2px'}}>{val}</div>
        </div>
      ))}
    </div>
  )
}

export default function FinancialsReceiptCard({ propId, agreement, property, saved, readOnly, showToast }) {
  const currency = agreement?.currency || 'INR'
  const baseRent = parseFloat(agreement?.agreed_rent) || 0
  const maintenance = parseFloat(agreement?.maintenance_fee) || 0
  const period = currentPeriodMonth()

  const [txns, setTxns] = useState([])
  const [loadingTxns, setLoadingTxns] = useState(true)
  const [posting, setPosting] = useState(false)
  const [showException, setShowException] = useState(false)
  const [lateFee, setLateFee] = useState('')
  const [paidDate, setPaidDate] = useState(localTodayStr())
  const [generatingReceipt, setGeneratingReceipt] = useState(null) // 'deposit' | txn_id | null
  const [useDocxDeposit, setUseDocxDeposit] = useState(false)
  const [useDocxAdvance, setUseDocxAdvance] = useState(false)
  const [useDocxRent, setUseDocxRent] = useState(false) // shared toggle for all rent-ledger rows -- per-row toggles would clutter a list that can have many postings

  const [advanceAmount, setAdvanceAmount] = useState('')
  const [advanceDate, setAdvanceDate] = useState(localTodayStr())
  const [advanceMode, setAdvanceMode] = useState('UPI')

  useEffect(() => { if (saved) loadTxns() }, [propId, saved])

  async function loadTxns() {
    setLoadingTxns(true)
    try {
      const data = await api.getRentTransactions(propId)
      setTxns(Array.isArray(data) ? data : [])
    } catch (e) { console.warn(e) }
    finally { setLoadingTxns(false) }
  }

  const alreadyPostedThisMonth = txns.some(t => t.period_month === period)

  async function postPayment({ isException, lateFeeAmount, paidDateVal }) {
    setPosting(true)
    try {
      const res = await api.postRentPayment({
        propId, periodMonth: period,
        baseRent, maintenance,
        lateFee: isException ? (parseFloat(lateFeeAmount) || 0) : 0,
        paidDate: paidDateVal || localTodayStr(),
        currency, isException,
      })
      showToast(isException ? '✅ Payment posted with late fee' : '✅ Posted for current month')
      setShowException(false); setLateFee('')
      await loadTxns()
      return res
    } catch (e) {
      showToast(e.message, 'error')
      return null
    } finally {
      setPosting(false)
    }
  }

  async function handleDepositReceipt() {
    if (!saved) { showToast('Save the agreement first', 'error'); return }
    setGeneratingReceipt('deposit')
    try {
      await generateDepositReceipt(!useDocxDeposit, agreement, property)
      showToast('🧾 Deposit receipt generated')
    } catch (e) { showToast(e.message, 'error') }
    finally { setGeneratingReceipt(null) }
  }

  async function handleRentReceipt(txn) {
    setGeneratingReceipt(txn.txn_id)
    try {
      await generateRentReceipt(!useDocxRent, txn, agreement, property)
      showToast(`🧾 Receipt generated for ${txn.period_month}`)
    } catch (e) { showToast(e.message, 'error') }
    finally { setGeneratingReceipt(null) }
  }

  async function handlePostAdvance() {
    if (!saved) { showToast('Save the agreement first', 'error'); return }
    if (!advanceAmount || parseFloat(advanceAmount) <= 0) { showToast('Enter an advance amount', 'error'); return }
    // Advance isn't a monthly rent posting, so it doesn't go through
    // rent_transactions (which is keyed one-row-per-period). It's recorded
    // as a deposit-style receipt instead — the same downloadDepositReceipt
    // path, but with the live advance amount/date/mode rather than the
    // agreement's stored deposit. This mirrors the spec's "Post Advance &
    // Generate Receipt" as a receipt-generation action, since there's no
    // separate advances ledger table to post into yet.
    setGeneratingReceipt('advance')
    try {
      await generateDepositReceipt(!useDocxAdvance, {
        ...agreement,
        deposit: parseFloat(advanceAmount),
        _depositPaymentMode: advanceMode,
      }, property)
      showToast('🧾 Advance receipt generated')
    } catch (e) { showToast(e.message, 'error') }
    finally { setGeneratingReceipt(null) }
  }

  return (
    <div className="card">
      <div className="card-section-label">Financial Parameters</div>
      <TermsGrid agreement={agreement} currency={currency} />

      {!readOnly && (
        <>
          <div className="card-section-label">Quick-Post — {period}</div>
          {!saved ? (
            <div style={{fontSize:'0.78rem', color:'var(--text-dim)', padding:'8px 0'}}>
              Save the agreement first to enable billing.
            </div>
          ) : alreadyPostedThisMonth ? (
            <button disabled style={{
              width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid rgba(52,168,83,0.4)',
              background:'rgba(52,168,83,0.12)', color:'#34A853', fontWeight:'700', fontSize:'0.88rem', cursor:'default',
            }}>
              ✓ Posted for Current Month
            </button>
          ) : (
            <>
              <button
                onClick={() => postPayment({ isException: false })}
                disabled={posting}
                style={{
                  width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid rgba(52,168,83,0.5)',
                  background: posting ? 'rgba(52,168,83,0.2)' : '#34A853', color:'#fff',
                  fontWeight:'700', fontSize:'0.88rem', cursor: posting ? 'default' : 'pointer', opacity: posting ? 0.7 : 1,
                }}>
                {posting ? 'Posting…' : `✓ Paid on Time — ${fmt(baseRent + maintenance, currency)}`}
              </button>

              <button
                onClick={() => setShowException(v => !v)}
                style={{
                  width:'100%', marginTop:'8px', padding:'9px', borderRadius:'10px',
                  border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)',
                  fontWeight:'600', fontSize:'0.78rem', cursor:'pointer',
                }}>
                {showException ? '— Hide exception entry' : 'Post Late / Exception'}
              </button>

              {showException && (
                <div style={{marginTop:'10px', padding:'12px', borderRadius:'10px', background:'var(--dark-input)', border:'1px solid var(--border-dim)'}}>
                  <label style={F.label}>LATE FEE AMOUNT ({currency === 'USD' ? '$' : '₹'})</label>
                  <input type="number" min="0" value={lateFee} onChange={e=>setLateFee(e.target.value)}
                    placeholder="0" style={F.input}/>

                  <label style={F.label}>ACTUAL PAYMENT RECEIVED DATE</label>
                  <input type="date" value={paidDate} onChange={e=>setPaidDate(e.target.value)} style={F.input}/>

                  <div style={{marginTop:'12px', padding:'10px 12px', borderRadius:'8px', background:'rgba(200,144,58,0.08)', border:'1px solid rgba(200,144,58,0.25)'}}>
                    <div style={{fontSize:'0.62rem', color:'var(--text-dim)', letterSpacing:'0.5px', textTransform:'uppercase'}}>Calculated Total Due</div>
                    <div style={{fontSize:'1.05rem', color:'#C8903A', fontWeight:'700', marginTop:'2px'}}>
                      {fmt(baseRent + maintenance + (parseFloat(lateFee) || 0), currency)}
                    </div>
                  </div>

                  <button
                    onClick={() => postPayment({ isException: true, lateFeeAmount: lateFee, paidDateVal: paidDate })}
                    disabled={posting}
                    style={{
                      width:'100%', marginTop:'12px', padding:'10px', borderRadius:'8px', border:'none',
                      background:'#185FA5', color:'#fff', fontWeight:'700', fontSize:'0.85rem',
                      cursor: posting ? 'default' : 'pointer', opacity: posting ? 0.7 : 1,
                    }}>
                    {posting ? 'Saving…' : 'Save Total to Ledger'}
                  </button>
                </div>
              )}
            </>
          )}

          {!loadingTxns && txns.length > 0 && (
            <div style={{marginTop:'14px'}}>
              <div style={{fontSize:'0.62rem', color:'var(--text-dim)', letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:'6px'}}>
                Recent Postings
              </div>
              <FormatToggle useDocx={useDocxRent} onChange={setUseDocxRent} idSuffix="rent" />
              {txns.slice(0, 6).map(t => (
                <div key={t.txn_id} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'8px 10px', borderRadius:'8px', marginBottom:'4px',
                  background:'var(--dark-input)', border:'1px solid var(--border-dim)',
                }}>
                  <div>
                    <span style={{fontSize:'0.8rem', color:'var(--text)', fontWeight:'600'}}>{t.period_month}</span>
                    {t.late_fee > 0 && <span style={{fontSize:'0.68rem', color:'#F59E0B', marginLeft:'8px'}}>+ late fee {fmt(t.late_fee, t.currency)}</span>}
                    <div style={{fontSize:'0.68rem', color:'var(--text-dim)'}}>{fmtDate(t.paid_date)} · {fmt(t.total_due, t.currency)}</div>
                  </div>
                  <button onClick={() => handleRentReceipt(t)} disabled={generatingReceipt === t.txn_id}
                    style={{
                      padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(24,95,165,0.4)',
                      background:'rgba(24,95,165,0.1)', color:'#185FA5', fontSize:'0.7rem', fontWeight:'600', cursor:'pointer',
                      opacity: generatingReceipt === t.txn_id ? 0.5 : 1,
                    }}>
                    {generatingReceipt === t.txn_id ? '…' : '🧾 Receipt'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="card-section-label">Deposit & Advance Receipts</div>
      <button onClick={handleDepositReceipt} disabled={readOnly || !saved || generatingReceipt === 'deposit'}
        style={{
          width:'100%', padding:'11px', borderRadius:'10px', border:'1px solid rgba(24,95,165,0.4)',
          background:'rgba(24,95,165,0.1)', color:'#185FA5', fontWeight:'700', fontSize:'0.85rem',
          cursor: (readOnly || !saved) ? 'default' : 'pointer', opacity: (readOnly || !saved) ? 0.5 : 1,
        }}>
        {generatingReceipt === 'deposit' ? 'Generating…' : `🧾 Generate Deposit Receipt — ${fmt(agreement?.deposit, currency)}`}
      </button>
      <FormatToggle useDocx={useDocxDeposit} onChange={setUseDocxDeposit} idSuffix="deposit" />

      {!readOnly && (
        <div style={{marginTop:'12px', padding:'12px', borderRadius:'10px', background:'var(--dark-input)', border:'1px solid var(--border-dim)'}}>
          <label style={F.label}>ADVANCE AMOUNT RECEIVED ({currency === 'USD' ? '$' : '₹'})</label>
          <input type="number" min="0" value={advanceAmount} onChange={e=>setAdvanceAmount(e.target.value)} placeholder="0" style={F.input}/>

          <div className="grid-2">
            <div>
              <label style={F.label}>PAYMENT DATE</label>
              <input type="date" value={advanceDate} onChange={e=>setAdvanceDate(e.target.value)} style={F.input}/>
            </div>
            <div>
              <label style={F.label}>PAYMENT MODE</label>
              <select value={advanceMode} onChange={e=>setAdvanceMode(e.target.value)} style={F.input}>
                <option>UPI</option><option>Transfer</option><option>Check</option><option>Cash</option>
              </select>
            </div>
          </div>

          <button onClick={handlePostAdvance} disabled={!saved || generatingReceipt === 'advance'}
            style={{
              width:'100%', marginTop:'10px', padding:'10px', borderRadius:'8px', border:'none',
              background:'#C8903A', color:'#fff', fontWeight:'700', fontSize:'0.85rem',
              cursor: (!saved) ? 'default' : 'pointer', opacity: (!saved || generatingReceipt === 'advance') ? 0.6 : 1,
            }}>
            {generatingReceipt === 'advance' ? 'Generating…' : 'Post Advance & Generate Receipt'}
          </button>
          <FormatToggle useDocx={useDocxAdvance} onChange={setUseDocxAdvance} idSuffix="advance" />
        </div>
      )}
    </div>
  )
}
