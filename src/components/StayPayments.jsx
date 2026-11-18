// "Payments" on Complete booking: what the guest has paid against the booking, and on which day, in parts if the host works that way.
// The server decides what matters (whether this is a booking the host collects, the total, the balance, whether an amount can be typed);
// this card only draws it and sends the owner's taps. See getStayPayments / addStayPayment / removeStayPayment in
// functions/api/[[route]].js and the rules in src/utils/stayPayments.js. A host that has not switched Payments on, and a booking a
// platform collects (Airbnb ...), show nothing at all.
import { useState, useEffect } from 'react'
import { api } from '../api'
import { parseLocalDate, localTodayStr, fmtStampZ } from '../utils/dates'
import { rupees } from '../utils/monthlyOutlook'

const dayText = d => {
  const p = parseLocalDate(d)
  return p && !isNaN(p) ? p.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : String(d || '')
}
const actorName = a => (a ? String(a).replace(/^staff-/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '')
const small = { color: 'var(--text-dim)', fontSize: '0.72rem' }

function Figure({ label, value, color }) {
  return (
    <div>
      <div style={{ ...small, fontSize: '0.62rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

// stayId: the open booking. screenTotal: the total the screen has worked out (it may be ahead of what is saved). refreshKey: anything that
// changes when the booking is saved, so the total is read again. onToast(message, type): the screen's own toast.
export default function StayPayments({ stayId, screenTotal, refreshKey, onToast }) {
  const [view, setView] = useState(null)     // what the server says about this booking's payments
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState({ amount: '', paidDate: '', mode: '', note: '' })

  useEffect(() => { setView(null); setError(''); setAdding(false) }, [stayId])

  useEffect(() => {
    let alive = true
    if (!stayId) return undefined
    api.getStayPayments(stayId)
      .then(v => { if (alive) { setView(v); setError('') } })
      .catch(e => { if (alive) setError(String((e && e.message) || 'Could not load the payments')) })
    return () => { alive = false }
  }, [stayId, refreshKey])

  if (error && /owner access/i.test(error)) return null
  if (error && !view) return <div style={{ ...small, margin: '0 0 8px' }}>Payments could not be loaded: {error}</div>
  if (!view || !view.enabled || !view.applies) return null

  if (view.ready === false) {
    return (
      <>
        <div className="card-section-label">PAYMENTS</div>
        <div className="card" style={small}>Payments are switched on, but this database has not been set up for them yet. It is a one-time step.</div>
      </>
    )
  }

  const s = view.summary
  const active = !['void', 'cancelled'].includes(view.stayStatus)
  const canAdd = active && (view.split || s.balance > 0)
  const unsaved = Number.isFinite(Number(screenTotal)) && Math.abs(Number(screenTotal) - s.total) > 0.5

  function openForm() {
    setDraft({ amount: view.split && s.balance > 0 ? String(s.balance) : '', paidDate: localTodayStr(), mode: '', note: '' })
    setAdding(true)
  }

  async function save(allowOver) {
    if (view.split && !(Number(draft.amount) > 0)) { onToast && onToast('Enter the amount that came in', 'error'); return }
    setBusy(true)
    try {
      const v = await api.addStayPayment({
        stayId, paidDate: draft.paidDate, paymentMode: draft.mode, note: draft.note,
        ...(view.split ? { amount: Number(draft.amount) } : {}),
        ...(allowOver ? { allowOver: true } : {}),
      })
      setView(v)
      setAdding(false)
      onToast && onToast(v && v.duplicate ? 'That payment was already recorded' : 'Payment recorded ✓')
    } catch (e) {
      // More than the balance: the server asks first (a typo of one zero is the usual cause); a yes sends it again as confirmed.
      if (e && e.code === 'over_balance' && !allowOver) {
        if (window.confirm(e.message)) { await save(true); return }
      } else {
        onToast && onToast('Failed: ' + ((e && e.message) || 'could not save'), 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(p) {
    if (!window.confirm(`Remove the payment of ${rupees(p.amount)} from ${dayText(p.paidDate)}? It stays on record as removed.`)) return
    setBusy(true)
    try {
      const v = await api.removeStayPayment({ paymentId: p.paymentId })
      setView(v)
      onToast && onToast('Payment removed')
    } catch (e) {
      onToast && onToast('Failed: ' + ((e && e.message) || 'could not remove'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const statusLine = s.status === 'paid'
    ? { color: '#34A853', text: `✓ Paid in full${s.paidInFullOn ? ' on ' + dayText(s.paidInFullOn) : ''}${s.over > 0 ? ` · ${rupees(s.over)} more than the total` : ''}` }
    : s.status === 'part'
      ? { color: 'var(--gold)', text: `Part paid · ${rupees(s.balance)} still to come` }
      : s.status === 'received'
        ? { color: 'var(--text-dim)', text: 'Received · set the booking price to see the balance' }
        : { color: 'var(--text-dim)', text: 'Not paid yet' }

  return (
    <>
      <div className="card-section-label">PAYMENTS</div>
      <div className="card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <Figure label="Booking total" value={s.total > 0 ? rupees(s.total) : '—'} />
          <Figure label="Received" value={rupees(s.paid)} color={s.paid > 0 ? '#34A853' : undefined} />
          <Figure label="Balance" value={s.total > 0 ? rupees(s.balance) : '—'} color={s.total > 0 && s.balance > 0 ? 'var(--gold)' : undefined} />
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: statusLine.color }}>{statusLine.text}</div>
        {active && !view.split && s.total <= 0 && s.paid <= 0 && (
          <div style={{ ...small, marginTop: '4px' }}>Set the booking price above and save it, then you can mark it paid here.</div>
        )}

        {view.payments.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-dim)', marginTop: '10px' }}>
            {view.payments.map(p => (
              <div key={p.paymentId} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text)' }}>{dayText(p.paidDate)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{rupees(p.amount)}</span>
                  <button disabled={busy} onClick={() => remove(p)} aria-label="Remove this payment" title="Remove this payment"
                    style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
                <div style={small}>
                  {[p.mode, p.note].filter(Boolean).join(' · ')}{(p.mode || p.note) ? ' · ' : ''}recorded {fmtStampZ(p.recordedAt)}{p.recordedBy ? ` · ${actorName(p.recordedBy)}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {unsaved && (
          <div style={{ ...small, color: '#E8B86D', marginTop: '8px' }}>
            The total on this screen ({rupees(screenTotal)}) is not saved yet: the balance above is worked out on the saved total
            ({s.total > 0 ? rupees(s.total) : 'none yet'}). Save the financial details to update it.
          </div>
        )}

        {adding ? (
          <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-dim)', paddingTop: '12px' }}>
            {view.split ? (
              <div className="field">
                <label className="field-label">Amount received (₹)</label>
                <input className="field-input gold" type="number" inputMode="decimal" placeholder="0" value={draft.amount}
                  onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} />
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '10px' }}>
                Marks the balance, <strong style={{ color: 'var(--gold)' }}>{rupees(s.balance)}</strong>, as received.
              </div>
            )}
            <div className="grid-2">
              <div className="field">
                <label className="field-label">Received on</label>
                <input className="field-input" type="date" value={draft.paidDate} max={localTodayStr()}
                  onChange={e => setDraft(d => ({ ...d, paidDate: e.target.value }))} />
              </div>
              <div className="field">
                <label className="field-label">How</label>
                <select className="field-input" value={draft.mode} onChange={e => setDraft(d => ({ ...d, mode: e.target.value }))}>
                  <option value="">—</option>
                  {view.modes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="field-label">Reference or note (optional)</label>
              <input className="field-input" type="text" maxLength={200} placeholder="e.g. UPI reference, or advance" value={draft.note}
                onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-gold" disabled={busy} onClick={() => save(false)}>{busy ? 'Saving…' : 'Save payment'}</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        ) : (canAdd && (
          <button className="btn btn-gold" style={{ marginTop: '12px' }} onClick={openForm}>
            {view.split ? '+ Add a payment' : `Mark ${rupees(s.balance)} as paid`}
          </button>
        ))}
      </div>
    </>
  )
}
