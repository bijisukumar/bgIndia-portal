import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { INVENTORY_MASTER } from './Inventory'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

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
  const [custom, setCustom] = useState({ name: '', price: '', qty: 0 })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    api.getActiveStay(DEFAULT_VILLA_ID)
      .then(s => { 
        if (s && s.stayId) {
          setStay({
            stayId: s.stayId,
            guestName: s.guestName || 'Active Guest',
            checkoutDate: s.checkoutDate || '—',
            nights: s.nights || '—',
            isHistoricalSession: false
          })
        }
      })
      .catch(() => {})

    api.getRecentCheckouts(DEFAULT_VILLA_ID)
      .then(d => { 
        if (Array.isArray(d)) {
          setRecentCheckouts(d)
        } 
      })
      .catch(() => {})

    api.getInventoryPrices?.(DEFAULT_VILLA_ID)
      .then(p => {
        if (p) {
          const flatPrices = {}
          Object.keys(p).forEach(itemId => {
            if (p[itemId] && typeof p[itemId] === 'object') {
              flatPrices[itemId] = p[itemId].sellPrice || p[itemId].sell_price || 0
            } else {
              flatPrices[itemId] = p[itemId]
            }
          })
          setPrices(prev => ({ ...prev, ...flatPrices }))
        }
      })
      .catch(() => {})
  }, [])

  const setQty = (id, qty) => setCart(c => ({ ...c, [id]: Math.max(0, qty) }))
  const itemTotal = (id) => (cart[id] || 0) * (Number(prices[id]) || 0)
  const total = CHECKOUT_ITEMS.reduce((s, i) => s + itemTotal(i.id), 0)
    + (custom.qty || 0) * (parseFloat(custom.price) || 0)

  const handleSave = async () => {
    const items = [
      ...CHECKOUT_ITEMS
        .filter(i => (cart[i.id] || 0) > 0)
        .map(i => ({
          itemId: i.id, name: i.name, qty: cart[i.id],
          pricePerUnit: Number(prices[i.id]) || i.sellPrice,
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

    // 1) Save the incidentals. If this fails, surface the real reason and stop.
    let saveResult
    try {
      saveResult = await api.saveKitchenEntry({ stayId: stay?.stayId, guestName: stay?.guestName, items, totalAmount: total, notes, villaId: DEFAULT_VILLA_ID })
    } catch (e) {
      showToast(e?.message || 'Failed to save incidentals', 'error')
      setSaving(false)
      return
    }

    // Incidentals are saved — clear the form now so a checkout retry can't re-add them.
    setCart({}); setNotes(''); setCustom({ name: '', price: '', qty: 0 })

    // 2) Check the guest out (skip for historical/retroactive sessions).
    try {
      let commMsg = ''
      if (stay && !stay.isHistoricalSession) {
        const result = await api.checkOut({ stayId: stay?.stayId })
        if (result?.commissionCreated) commMsg = ` · Raman ₹${result.ramanComm} commission logged`
      } else {
        commMsg = ' · Retroactive items added'
      }
      showToast(`Check-out saved ✓${commMsg}`)
      if (stay?.isHistoricalSession) setStay(null)
    } catch (e) {
      showToast(`Items saved, but checkout step failed: ${e?.message || 'error'}`, 'error')
    }

    // Low-stock warnings from the save step.
    const lowStockAlerts = saveResult?.lowStockAlerts || []
    if (lowStockAlerts.length) {
      const names = lowStockAlerts.map(a => `${a.name} (${a.qtyInStock} left)`).join(', ')
      setTimeout(() => showToast(`⚠️ Low stock: ${names}`, 'error'), 1200)
    }
    setSaving(false)
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
        <div className="card" style={{ padding: '14px', marginBottom: '12px', background: 'var(--card-bg)' }}>
          {stay && stay.stayId ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#5C7080', fontSize: '0.65rem' }}>
                  {stay.isHistoricalSession ? '🔴 RETROACTIVE BILLING SESSION' : '🟢 ACTIVE LIVE STAY'}
                </div>
                <div style={{ color: 'var(--gold)', fontWeight: '700', fontSize: '0.9rem' }}>
                  {stay.guestName} ({stay.stayId})
                </div>
              </div>
              {stay.isHistoricalSession && (
                <button onClick={() => setStay(null)} style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>✕ Clear Selection</button>
              )}
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#F59E0B', marginBottom: '6px', fontWeight: '600' }}>
                ⚠️ No active stay found. Select a recent checkout to apply charges:
              </label>
              {recentCheckouts.length > 0 ? (
                <select 
                  onChange={(e) => {
                    const chosen = recentCheckouts.find(r => r.stay_id === e.target.value)
                    if (chosen) {
                      setStay({ 
                        stayId: chosen.stay_id, 
                        guestName: chosen.guest_name, 
                        checkoutDate: chosen.checkout_date, 
                        nights: chosen.nights || 1, 
                        isHistoricalSession: true 
                      })
                    } else {
                      setStay(null)
                    }
                  }}
                  className="field-input"
                  style={{ width: '100%', background: '#1A202C', color: '#FFF', padding: '8px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  <option value="">-- Choose a past checkout --</option>
                  {recentCheckouts.map(s => (
                    <option key={s.stay_id} value={s.stay_id}>
                      {s.guest_name} (Checked out: {s.checkout_date})
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No recent checkouts found.</div>
              )}
            </div>
          )}
        </div>

        <div className="card-section-label">KITCHEN INCIDENTALS
          <span style={{ color: '#5C7080', fontWeight: 400, fontSize: '0.7rem', marginLeft: '6px' }}>prices from inventory</span>
        </div>
        <div className="card">
          {CHECKOUT_ITEMS.map((item, i) => {
            const qty   = cart[item.id] || 0
            const price = Number(prices[item.id]) || item.sellPrice
            const sub   = qty * price
            return (
              <div key={item.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                paddingBottom: '12px', marginBottom: '12px',
                borderBottom: i < CHECKOUT_ITEMS.length - 1 ? '1px solid var(--border-dim)' : 'none',
                alignItems: 'center', gap: '8px',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontSize: '0.88rem', fontWeight: '500' }}>{item.name}</div>
                  <div style={{ color: '#5C7080', fontSize: '0.72rem', display: 'flex', flexWrap: 'wrap', columnGap: '6px', rowGap: '2px' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>₹{price} / {item.unit}</span>
                    {sub > 0 && <span style={{ color: 'var(--gold)', fontWeight: '700', whiteSpace: 'nowrap' }}>= ₹{sub.toLocaleString('en-IN')}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => setQty(item.id, qty - 1)}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer' }}>−</button>
                  <span style={{ color: 'var(--gold)', fontWeight: '700', minWidth: '22px', textAlign: 'center', fontSize: '0.95rem' }}>{qty}</span>
                  <button onClick={() => setQty(item.id, qty + 1)}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            )
          })}

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

        <button className="btn btn-gold" onClick={handleSave} disabled={saving || total === 0 || !stay}>
          {saving ? 'Saving...' : !stay ? 'Select a guest context above' : total > 0 ? `Save · ₹${total.toLocaleString('en-IN')} →` : 'Add items above'}
        </button>
        <p className="btn-email-note">📧 Owner notified on save</p>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}