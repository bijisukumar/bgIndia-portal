// ============================================================
//  AgentQuote.jsx — Public self-serve quote calculator
//  Route: /quote/:token  (no login required)
// ============================================================
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CONFIG } from '../../config'

const INP = { width: '100%', padding: '10px 12px', borderRadius: '8px', boxSizing: 'border-box', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.95rem' }
const LBL = { display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '5px' }

function fmt(n) { return `₹${Math.round(n || 0).toLocaleString('en-IN')}` }

export default function AgentQuote() {
  const { token } = useParams()
  const [form, setForm] = useState({ checkinDate: '', checkoutDate: '', adults: '2', children: '0' })
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setQuote(null); setError(null) }

  async function handleQuote() {
    if (!form.checkinDate || !form.checkoutDate) { setError('Pick check-in and check-out dates'); return }
    setLoading(true); setError(null); setQuote(null)
    try {
      const res = await fetch('/api/getAgentQuote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          checkinDate: form.checkinDate,
          checkoutDate: form.checkoutDate,
          adults: form.adults,
          children: form.children,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success === false) {
        setError(data?.error || 'Could not get a quote — check your link with the host')
        return
      }
      setQuote(data.data)
    } catch (e) {
      setError('Network error — please try again')
    } finally { setLoading(false) }
  }

  return (
    <div className="screen" style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ padding: '20px 16px 14px', textAlign: 'center', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 600, color: 'var(--gold)' }}>
          {CONFIG.brandName}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '2px', marginTop: '2px' }}>
          PARTNER QUOTE CALCULATOR
        </div>
      </div>

      <div className="screen-body" style={{ padding: '20px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={LBL}>CHECK-IN</label>
            <input type="date" value={form.checkinDate} onChange={e => set('checkinDate', e.target.value)} style={INP} />
          </div>
          <div>
            <label style={LBL}>CHECK-OUT</label>
            <input type="date" value={form.checkoutDate} onChange={e => set('checkoutDate', e.target.value)} style={INP} />
          </div>
          <div>
            <label style={LBL}>ADULTS</label>
            <input type="number" min="0" value={form.adults} onChange={e => set('adults', e.target.value)} style={INP} />
          </div>
          <div>
            <label style={LBL}>CHILDREN</label>
            <input type="number" min="0" value={form.children} onChange={e => set('children', e.target.value)} style={INP} />
          </div>
        </div>

        <button onClick={handleQuote} disabled={loading}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--gold)', color: '#1A202C', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', opacity: loading ? 0.6 : 1, marginBottom: '16px' }}>
          {loading ? 'Calculating…' : 'Get quote'}
        </button>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 14px', color: '#EF4444', fontSize: '0.82rem', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {quote && (
          <div className="net-box">
            <div className="net-row">
              <span className="net-label">Nights</span>
              <span className="net-val">{quote.nights}</span>
            </div>
            <div className="net-row">
              <span className="net-label">Estimated bedrooms needed</span>
              <span className="net-val">{quote.bedroomEstimate}</span>
            </div>
            <div className="net-row">
              <span className="net-label">Tariff / night</span>
              <span className="net-val">{fmt(quote.tariffPerNight)}</span>
            </div>
            {!quote.withinRecommended && (
              <div style={{ fontSize: '0.72rem', color: '#F59E0B', margin: '6px 0' }}>
                ⚠️ {quote.billableGuests} guests is above our comfortably-recommended capacity — extra floor beds apply.
              </div>
            )}
            {quote.discountPct > 0 && (
              <>
                <div className="net-row">
                  <span className="net-label">Subtotal</span>
                  <span className="net-val">{fmt(quote.subtotal)}</span>
                </div>
                <div className="net-row">
                  <span className="net-label">Partner discount ({quote.discountPct}%)</span>
                  <span className="net-val pos">−{fmt(quote.subtotal - quote.total)}</span>
                </div>
              </>
            )}
            <div className="net-divider" />
            <div className="net-row">
              <span style={{ color: '#EDF2F7', fontWeight: '600', fontSize: '1rem' }}>Total estimate</span>
              <span className="net-val big">{fmt(quote.total)}</span>
            </div>
          </div>
        )}

        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '18px', lineHeight: 1.6 }}>
          This is an estimate for {quote?.agentName || 'your agency'}. Final pricing is confirmed by the host
          before booking.
        </div>
      </div>
    </div>
  )
}
