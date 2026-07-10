import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

// Low-stock threshold matches Inventory.jsx's Stock tab exactly (10% of
// preferred level) so both screens agree on what counts as "low."
function isLowStock(qtyInStock, preferred) {
  const threshold = Math.ceil((preferred || 0) * 0.1)
  return (preferred || 0) > 0 && (qtyInStock || 0) <= threshold
}

// A guest whose stay period has ended but hasn't been formally checked
// out yet ('ready_for_checkout') is NOT historical — saving here should
// still run the actual checkout (handleSave's existing `!isHistoricalSession`
// check already does this correctly once this is set right). Only an
// already-processed checked_out/closed stay is historical/retroactive.
function guestLabel(g) {
  if (g.status === 'checked_in') return `🟢 ${g.guestName} — active stay`
  if (g.status === 'ready_for_checkout') return `🟡 ${g.guestName} — ready for checkout`
  return `${g.guestName} — checked out ${g.checkoutDate}`
}

export default function KitchenIncidentals() {
  const navigate  = useNavigate()
  const [stay, setStay]     = useState(null)
  const [cart, setCart]     = useState({})
  // Live catalog (kitchen category, active items only) — was previously a
  // hardcoded import-time snapshot that never reflected archived/renamed/
  // added items from the Inventory screen. Now fetched the same way
  // Inventory.jsx and PreferredStock.jsx already do.
  const [checkoutItems, setCheckoutItems] = useState([])
  const [prices, setPrices] = useState({})
  const [stock, setStock]   = useState({})
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]         = useState(null)
  // Combined list: active stay (if any) first, then recent checkouts —
  // always offered together so Raman can log a just-checked-out guest's
  // charges (kitchen/breakfast/car rental often land 1-2 days late) even
  // after a new guest has already checked in and become the active stay.
  const [guestOptions, setGuestOptions] = useState([])
  const [custom, setCustom] = useState({ name: '', price: '', qty: 0 })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    Promise.all([
      api.getActiveStay(DEFAULT_VILLA_ID).catch(() => null),
      api.getRecentCheckouts(DEFAULT_VILLA_ID).catch(() => []),
    ]).then(([active, checkouts]) => {
      const options = [
        ...(active && active.stayId ? [{
          stayId: active.stayId, guestName: active.guestName || 'Active Guest',
          checkoutDate: active.checkoutDate || '—', nights: active.nights || '—',
          status: 'checked_in', isHistoricalSession: false,
        }] : []),
        ...(Array.isArray(checkouts) ? checkouts.map(c => ({
          stayId: c.stay_id, guestName: c.guest_name,
          checkoutDate: c.checkout_date, nights: c.nights || 1,
          status: c.status, isHistoricalSession: c.status !== 'ready_for_checkout',
        })) : []),
      ]
      setGuestOptions(options)
      if (options.length) setStay(options[0])
    })

    api.getInventory(DEFAULT_VILLA_ID)
      .then(rows => {
        if (!Array.isArray(rows)) return
        const kitchenRows = rows.filter(r => (r.category || 'other') === 'kitchen')
        setCheckoutItems(kitchenRows.map(r => ({ id: r.item_id, name: r.name, unit: r.unit || 'unit', sellPrice: r.sell_price ?? 0 })))
        setPrices(Object.fromEntries(kitchenRows.map(r => [r.item_id, r.sell_price ?? 0])))
        setStock(Object.fromEntries(kitchenRows.map(r => [r.item_id, {
          qtyInStock: r.qty_in_stock ?? 0, preferredStock: r.preferred_stock ?? 10,
        }])))
      })
      .catch(() => {})
  }, [])

  const setQty = (id, qty) => setCart(c => ({ ...c, [id]: Math.max(0, qty) }))
  const itemTotal = (id) => (cart[id] || 0) * (Number(prices[id]) || 0)
  const total = checkoutItems.reduce((s, i) => s + itemTotal(i.id), 0)
    + (custom.qty || 0) * (parseFloat(custom.price) || 0)

  const handleSave = async () => {
    const items = [
      ...checkoutItems
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
          {guestOptions.length > 0 ? (
            <>
              <label style={{ display: 'block', fontSize: '0.65rem', color: '#5C7080', marginBottom: '6px', fontWeight: '600', letterSpacing: '1px' }}>
                GUEST CONTEXT — who are these charges for?
              </label>
              <select
                value={stay?.stayId || ''}
                onChange={(e) => {
                  const chosen = guestOptions.find(g => g.stayId === e.target.value)
                  if (chosen) setStay(chosen)
                }}
                className="field-input"
                style={{ width: '100%', background: '#1A202C', color: '#FFF', padding: '8px', borderRadius: '6px', border: '1px solid rgba(200,144,58,0.3)' }}
              >
                {guestOptions.map(g => (
                  <option key={g.stayId} value={g.stayId}>
                    {guestLabel(g)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No active stay or recent checkouts found.</div>
          )}
        </div>

        <div className="card-section-label">KITCHEN INCIDENTALS
          <span style={{ color: '#5C7080', fontWeight: 400, fontSize: '0.7rem', marginLeft: '6px' }}>prices from inventory</span>
        </div>
        <div className="card">
          {checkoutItems.map((item, i) => {
            const qty   = cart[item.id] || 0
            const price = Number(prices[item.id]) || item.sellPrice
            const sub   = qty * price
            const s     = stock[item.id] || {}
            const preferred = s.preferredStock ?? 10
            const low   = isLowStock(s.qtyInStock, preferred)
            return (
              <div key={item.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                paddingBottom: '12px', marginBottom: '12px',
                borderBottom: i < checkoutItems.length - 1 ? '1px solid var(--border-dim)' : 'none',
                alignItems: 'center', gap: '8px',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontSize: '0.88rem', fontWeight: '500' }}>{item.name}</div>
                  <div style={{ color: '#5C7080', fontSize: '0.72rem', display: 'flex', flexWrap: 'wrap', columnGap: '6px', rowGap: '2px' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>₹{price} / {item.unit}</span>
                    {sub > 0 && <span style={{ color: 'var(--gold)', fontWeight: '700', whiteSpace: 'nowrap' }}>= ₹{sub.toLocaleString('en-IN')}</span>}
                    <span style={{ whiteSpace: 'nowrap', color: low ? '#EF9A9A' : '#5C7080' }}>
                      · {s.qtyInStock ?? 0} in stock
                    </span>
                    {low && <span style={{ color: '#EF9A9A', fontSize: '0.7rem' }}>⚠️ Low (target {preferred})</span>}
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
          {checkoutItems.filter(i => (cart[i.id] || 0) > 0).map(i => (
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