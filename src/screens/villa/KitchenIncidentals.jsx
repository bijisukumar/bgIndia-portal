import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { INVENTORY_MASTER } from './Inventory'

// Only kitchen-category items are billable at checkout
const CHECKOUT_ITEMS = INVENTORY_MASTER.filter(i => i.category === 'kitchen')

export default function KitchenIncidentals() {
  const navigate  = useNavigate()
  const [stay, setStay]     = useState(null)
  const [cart, setCart]     = useState({})
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(CHECKOUT_ITEMS.map(i => [i.id, i.sellPrice]))
  )
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]         = useState(null)
  const [recentCheckouts, setRecentCheckouts] = useState([])
  // Custom / ad-hoc item
  const [custom, setCustom] = useState({ name: '', price: '', qty: 0 })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    api.getActiveStay('dwarka').then(s => { if (s?.stayId) setStay(s) }).catch(() => {})
    api.getRecentCheckouts('dwarka').then(d => { if (Array.isArray(d) && d.length) setRecentCheckouts(d) }).catch(() => {})
    // Fetch live prices from inventory if available
    api.getInventoryPrices?.('dwarka').then(p => {
      if (p) setPrices(prev => ({ ...prev, ...p }))
    }).catch(() => {})
  }, [])

  const setQty = (id, qty) => setCart(c => ({ ...c, [id]: Math.max(0, qty) }))
  const itemTotal = (id) => (cart[id] || 0) * (prices[id] || 0)
  const total = CHECKOUT_ITEMS.reduce((s, i) => s + itemTotal(i.id), 0)
    + (custom.qty || 0) * (parseFloat(custom.price) || 0)

  const handleSave = async () => {
    const items = [
      ...CHECKOUT_ITEMS
        .filter(i => (cart[i.id] || 0) > 0)
        .map(i => ({
          itemId: i.id, name: i.name, qty: cart[i.id],
          pricePerUnit: prices[i.id] || i.sellPrice,
          subtotal: itemTotal(i.id),
        })),
      ...(custom.qty > 0 && custom.name ? [{
        itemId: 'custom', name: custom.name, qty: custom.qty,
        pricePerUnit: parseFloat(custom.price) || 0,
        subtotal: custom.qty * (parseFloat(custom.price) || 0),
      }] : []),
    ]
    if (!items.length) { showToast('Add at least one item', 'error'); return }
    setSaving(true)
    try {
      // Save incidentals
      await api.saveKitchenEntry({ stayId: stay?.stayId, guestName: stay?.guestName, items, totalAmount: total, notes })
      // Complete the stay lifecycle — this triggers Raman commission creation
      const result = await api.checkOut({ stayId: stay?.stayId })
      const commMsg = result?.commissionCreated
        ? ` · Raman ₹${result.ramanComm} commission logged`
        : ''
      showToast(`Check-out saved ✓${commMsg}`)
      setCart({}); setNotes(''); setCustom({ name: '', price: '', qty: 0 })
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Check-out incidentals</div>
          <div className="topbar-sub">{stay?.guestName || 'No active stay'} · DWARKA</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      <div className="screen-body">
        {!stay ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
No active stay — check in a guest first
              {recentCheckouts.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#F59E0B', marginBottom: '8px', fontWeight: '600' }}>
                    Last 2 checkouts — add missed items:
                  </div>
                  {recentCheckouts.map(s => (
                    <div key={s.stay_id} onClick={() => setStay({ stayId: s.stay_id, guestName: s.guest_name, checkoutDate: s.checkout_date, numGuests: s.num_guests })}
                      style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', cursor: 'pointer', marginBottom: '6px' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#EDF2F7' }}>{s.guest_name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#F59E0B', marginTop: '2px' }}>Checked out: {s.checkout_date} · {s.num_guests} guests</div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        ) : (
          <>
            {/* Stay info banner */}
            <div style={{ background: 'rgba(200,144,58,0.08)', border: '1px solid rgba(200,144,58,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <div><div style={{ color: '#5C7080', fontSize: '0.65rem' }}>STAY ID</div><div style={{ color: 'var(--gold)', fontWeight: '700', fontSize: '0.9rem' }}>{stay.stayId}</div></div>
              <div><div style={{ color: '#5C7080', fontSize: '0.65rem' }}>CHECK-OUT</div><div style={{ color: 'var(--text)', fontWeight: '600', fontSize: '0.9rem' }}>{stay.checkoutDate || '—'}</div></div>
              <div><div style={{ color: '#5C7080', fontSize: '0.65rem' }}>NIGHTS</div><div style={{ color: 'var(--text)', fontWeight: '600', fontSize: '0.9rem' }}>{stay.nights || '—'}</div></div>
            </div>

            <div className="card-section-label">KITCHEN INCIDENTALS
              <span style={{ color: '#5C7080', fontWeight: 400, fontSize: '0.7rem', marginLeft: '6px' }}>prices from inventory</span>
            </div>
            <div className="card">
              {CHECKOUT_ITEMS.map((item, i) => {
                const qty   = cart[item.id] || 0
                const price = prices[item.id] || item.sellPrice
                const sub   = qty * price
                return (
                  <div key={item.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    paddingBottom: '12px', marginBottom: '12px',
                    borderBottom: i < CHECKOUT_ITEMS.length - 1 ? '1px solid var(--border-dim)' : 'none',
                    alignItems: 'center', gap: '8px',
                  }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontSize: '0.88rem', fontWeight: '500' }}>{item.name}</div>
                      <div style={{ color: '#5C7080', fontSize: '0.72rem' }}>
                        ₹{price} / {item.unit}
                        {sub > 0 && <span style={{ color: 'var(--gold)', fontWeight: '700', marginLeft: '8px' }}>= ₹{sub.toLocaleString('en-IN')}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => setQty(item.id, qty - 1)}
                        style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer' }}>−</button>
                      <span style={{ color: 'var(--gold)', fontWeight: '700', minWidth: '22px', textAlign: 'center', fontSize: '0.95rem' }}>{qty}</span>
                      <button onClick={() => setQty(item.id, qty + 1)}
                        style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                )
              })}

              {/* Ad-hoc item */}
              <div style={{ paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#5C7080', fontSize: '0.72rem', marginBottom: '8px' }}>AD-HOC / OTHER</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 50px', gap: '6px', alignItems: 'center' }}>
                  <input className="field-input" placeholder="Item name"
                    value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))}
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
                  <input className="field-input" placeholder="₹/unit" type="number"
                    value={custom.price} onChange={e => setCustom(c => ({ ...c, price: e.target.value }))}
                    style={{ fontSize: '0.82rem', padding: '6px 8px', color: 'var(--gold)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={() => setCustom(c => ({ ...c, qty: Math.max(0, c.qty - 1) }))}
                      style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.9rem' }}>−</button>
                    <span style={{ color: 'var(--gold)', fontWeight: '700', fontSize: '0.9rem', minWidth: '16px', textAlign: 'center' }}>{custom.qty}</span>
                    <button onClick={() => setCustom(c => ({ ...c, qty: c.qty + 1 }))}
                      style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.9rem' }}>+</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="field" style={{ marginBottom: 0 }}>
                <div className="field-label">Notes (optional)</div>
                <input className="field-input" placeholder="Any special requests or notes..."
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            {/* Total */}
            <div className="net-box">
              {CHECKOUT_ITEMS.filter(i => (cart[i.id] || 0) > 0).map(i => (
                <div key={i.id} className="net-row">
                  <span className="net-label">{i.name} × {cart[i.id]}</span>
                  <span className="net-val pos">₹{itemTotal(i.id).toLocaleString('en-IN')}</span>
                </div>
              ))}
              {custom.qty > 0 && custom.name && (
                <div className="net-row">
                  <span className="net-label">{custom.name} × {custom.qty}</span>
                  <span className="net-val pos">₹{(custom.qty * (parseFloat(custom.price) || 0)).toLocaleString('en-IN')}</span>
                </div>
              )}
              {total > 0 && <div className="net-divider" />}
              <div className="net-row">
                <span style={{ color: 'var(--text)', fontWeight: '700', fontSize: '1rem' }}>Total incidentals</span>
                <span className="net-val big">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <button className="btn btn-gold" onClick={handleSave} disabled={saving || total === 0}>
              {saving ? 'Saving...' : total > 0 ? `Save · ₹${total.toLocaleString('en-IN')} →` : 'Add items above'}
            </button>
            <p className="btn-email-note">📧 Owner notified on save</p>
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
