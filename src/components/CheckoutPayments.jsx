// "Check-out payments" on Complete booking (owner only): what the caretaker recorded when the guest paid for the incidentals at check-out
// (the QR code on the Check-out incidentals screen), with the tip kept apart, how it was paid, who recorded it and when, the invoice emails
// already sent for it, and the buttons to send the invoice again on WhatsApp or by email (or a test copy to the owner's own address).
// The server decides everything (getCheckoutPayments in functions/api/[[route]].js; the invoice's words come from the host's config through
// src/utils/checkoutInvoice.js); this only draws it and sends the owner's taps. A booking with no payment recorded, and anyone but the
// owner, see nothing at all.
import { useState, useEffect } from 'react'
import { api } from '../api'
import { parseLocalDate, fmtStampZ } from '../utils/dates'
import { inr } from '../utils/checkoutInvoice'

const dayText = d => {
  const p = parseLocalDate(d)
  return p && !isNaN(p) ? p.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : String(d || '')
}
const actorName = a => (a ? String(a).replace(/^staff-/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '')
const small = { color: 'var(--text-dim)', fontSize: '0.72rem' }
const smallBtn = { width: 'auto', flex: '1 1 120px', padding: '10px 12px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }
const waBtn = { ...smallBtn, display: 'block', textDecoration: 'none', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' }
const mailBtn = { ...smallBtn, background: 'rgba(133,183,235,0.1)', border: '1px solid rgba(133,183,235,0.3)', color: '#85B7EB' }

function Figure({ label, value, color }) {
  return (
    <div>
      <div style={{ ...small, fontSize: '0.62rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

// stayId: the open booking. refreshKey: anything that changes when the booking (or the guest's phone or email) is saved, so this is read
// again. onToast(message, type): the screen's own toast.
export default function CheckoutPayments({ stayId, refreshKey, onToast }) {
  const [view, setView] = useState(null)     // what the server says about this booking's check-out payments
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')       // '<reference>:email' or '<reference>:test' while a send is on its way

  useEffect(() => { setView(null); setError(''); setBusy('') }, [stayId])

  useEffect(() => {
    let alive = true
    if (!stayId) return undefined
    api.getCheckoutPayments(stayId)
      .then(v => { if (alive) { setView(v); setError('') } })
      .catch(e => { if (alive) setError(String((e && e.message) || 'Could not load the check-out payments')) })
    return () => { alive = false }
  }, [stayId, refreshKey])

  if (error && /owner access/i.test(error)) return null
  if (error && !view) return <div style={{ ...small, margin: '0 0 8px' }}>Check-out payments could not be loaded: {error}</div>
  const payments = (view && view.payments) || []
  if (!view || !payments.length) return null

  async function sendEmail(p, test) {
    const last = p.emails[p.emails.length - 1]
    if (!test && last && !window.confirm(`This invoice was already emailed to ${last.to} (${fmtStampZ(last.at)}). Send it again?`)) return
    setBusy(p.ref + (test ? ':test' : ':email'))
    try {
      const r = await api.sendCheckoutInvoiceEmail({ stayId, ref: p.ref, ...(test ? { test: true } : {}) })
      onToast && onToast(test ? `Test copy sent to ${(r && r.to) || 'you'} ✓` : (r && r.alreadySent ? `Already emailed to ${r.to}` : `Invoice emailed to ${(r && r.to) || 'the guest'} ✓`))
    } catch (e) {
      onToast && onToast('Failed: ' + ((e && e.message) || 'could not send'), 'error')
      setBusy('')
      return
    }
    try { setView(await api.getCheckoutPayments(stayId)) } catch { /* the send worked; the list shows it the next time it is read */ }
    setBusy('')
  }

  const t = view.totals || { amount: 0, tip: 0, total: 0 }

  return (
    <>
      <div className="card-section-label">CHECK-OUT PAYMENTS</div>
      <div className="card" data-testid="checkout-payments" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '4px' }}>
          <Figure label="Incidentals" value={inr(t.amount)} />
          <Figure label="Tips" value={inr(t.tip)} color={t.tip > 0 ? '#34A853' : undefined} />
          <Figure label="Collected" value={inr(t.total)} color="#34A853" />
        </div>

        {payments.map(p => {
          const wa = view.waNumber && p.whatsapp ? `https://wa.me/${view.waNumber}?text=${encodeURIComponent(p.whatsapp)}` : ''
          const last = p.emails[p.emails.length - 1]
          return (
            <div key={p.ref} data-testid="checkout-payment" style={{ padding: '10px 0 4px', marginTop: '8px', borderTop: '1px solid var(--border-dim)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text)' }}>{dayText(p.paidOn)} · {p.mode}</span>
                <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{inr(p.total)}</span>
              </div>
              <div style={small}>
                {p.tip > 0 ? `${inr(p.amount)} incidentals + ${inr(p.tip)} tip` : `${inr(p.amount)} incidentals, no tip`} · {p.ref}
              </div>
              <div style={small}>Recorded {fmtStampZ(p.recordedAt)}{p.by ? ` by ${actorName(p.by)}` : ''}</div>
              <div style={{ ...small, color: last ? '#34A853' : 'var(--text-dim)', marginTop: '2px' }}>
                {last
                  ? `✉️ Invoice emailed to ${last.to} · ${fmtStampZ(last.at)}${p.emails.length > 1 ? ` (${p.emails.length} times)` : ''}`
                  : 'Invoice not emailed yet · a WhatsApp send is not tracked here'}
              </div>

              {p.invoiceError ? (
                <div style={{ ...small, color: '#EF9A9A', marginTop: '6px' }}>{p.invoiceError}</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {wa ? (
                      <a href={wa} target="_blank" rel="noreferrer" className="btn" style={waBtn}>
                        📲 WhatsApp
                      </a>
                    ) : (
                      <span style={{ ...small, flex: '1 1 120px', alignSelf: 'center' }}>No phone on file for WhatsApp</span>
                    )}
                    {view.guestEmail ? (
                      <button type="button" className="btn" disabled={!!busy} onClick={() => sendEmail(p, false)} style={mailBtn}>
                        {busy === p.ref + ':email' ? 'Sending…' : last ? '✉️ Email again' : '✉️ Email'}
                      </button>
                    ) : (
                      <span style={{ ...small, flex: '1 1 120px', alignSelf: 'center' }}>No usable email on file. Add or fix it in Guest info.</span>
                    )}
                  </div>
                  <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => sendEmail(p, true)}
                    style={{ width: 'auto', padding: '8px 12px', fontSize: '0.78rem', marginTop: '8px' }}>
                    {busy === p.ref + ':test' ? 'Sending…' : 'Email me a test copy'}
                  </button>
                </>
              )}

              <details style={{ marginTop: '8px' }}>
                <summary style={{ ...small, cursor: 'pointer' }}>Items{p.text ? ' and the invoice text' : ''}</summary>
                <div style={{ marginTop: '6px' }}>
                  {p.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text)', padding: '2px 0' }}>
                      <span style={{ flex: 1 }}>{it.name}{it.qty > 1 ? ` × ${it.qty}` : ''}</span>
                      <span>{inr(it.subtotal)}</span>
                    </div>
                  ))}
                  {p.text && (
                    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit', fontSize: '0.75rem', color: 'var(--text-dim)', margin: '8px 0 0', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>{p.text}</pre>
                  )}
                </div>
              </details>
            </div>
          )
        })}

        {view.withoutPayment > 0 && (
          <div style={{ ...small, color: '#E8B86D', marginTop: '10px' }}>
            The incidentals saved for this guest add up to {inr(view.incidentalsSaved)}; {inr(view.withoutPayment)} of that has no payment recorded.
          </div>
        )}
      </div>
    </>
  )
}
