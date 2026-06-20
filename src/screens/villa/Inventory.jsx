import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

// Master inventory with sell prices — these are the prices used at checkout
// category: 'kitchen' | 'bathroom' | 'bedroom' | 'other'
export const INVENTORY_MASTER = [
  // Kitchen incidentals
  { id: 'water_bottle',   name: 'Water bottles',     unit: 'bottle',  category: 'kitchen',  costPrice: 18, sellPrice: 30,  defaultQty: 10 },
  { id: 'soft_drink',     name: 'Soft drinks',        unit: 'can',     category: 'kitchen',  costPrice: 40, sellPrice: 60,  defaultQty: 10 },
  { id: 'chocolate',      name: 'Chocolates',         unit: 'bar',     category: 'kitchen',  costPrice: 45, sellPrice: 70,  defaultQty: 10 },
  { id: 'chips',          name: 'Chips',              unit: 'packet',  category: 'kitchen',  costPrice: 30, sellPrice: 50,  defaultQty: 10 },
  { id: 'milk_packet',    name: 'Milk packets',       unit: 'packet',  category: 'kitchen',  costPrice: 30, sellPrice: 45,  defaultQty: 10 },
  { id: 'tea_coffee',     name: 'Tea / Coffee',       unit: 'cup',     category: 'kitchen',  costPrice: 15, sellPrice: 25,  defaultQty: 10 },
  { id: 'eggs',           name: 'Eggs',               unit: 'egg',     category: 'kitchen',  costPrice: 8,  sellPrice: 12,  defaultQty: 10 },
  { id: 'bread',          name: 'Bread',              unit: 'loaf',    category: 'kitchen',  costPrice: 35, sellPrice: 45,  defaultQty: 10 },
  // Bathroom
  { id: 'shampoo',        name: 'Shampoo',            unit: 'bottle',  category: 'bathroom', costPrice: 80, sellPrice: 0,   defaultQty: 10 },
  { id: 'body_wash',      name: 'Body wash',          unit: 'bottle',  category: 'bathroom', costPrice: 90, sellPrice: 0,   defaultQty: 10 },
  { id: 'bathroom_cleaner', name: 'Bathroom cleaner', unit: 'bottle',  category: 'bathroom', costPrice: 60, sellPrice: 0,   defaultQty: 10 },
  { id: 'tissue',         name: 'Tissue / toilet paper', unit: 'roll', category: 'bathroom', costPrice: 25, sellPrice: 0,  defaultQty: 10 },
  // Bedroom
  { id: 'bed_essential',  name: 'Bedroom essentials', unit: 'set',    category: 'bedroom',  costPrice: 0,  sellPrice: 0,   defaultQty: 10 },
]

const CATEGORIES = [
  { id: 'all',      label: 'All' },
  { id: 'kitchen',  label: '🍳 Kitchen' },
  { id: 'bathroom', label: '🚿 Bathroom' },
  { id: 'bedroom',  label: '🛏 Bedroom' },
]

function fmt(n) { return n ? `₹${Number(n).toLocaleString('en-IN')}` : '₹0' }

export default function Inventory() {
  const navigate = useNavigate()
  const [cat, setCat]   = useState('all')
  const [tab, setTab]   = useState('stock')   // 'stock' | 'prices' | 'restock'
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [addNew, setAddNew] = useState(false)
  const [restockLog, setRestockLog] = useState([])

  // Stock levels + prices — loaded from DB on mount; fall back to
  // INVENTORY_MASTER defaults for any item not yet in the DB for this villa.
  const [stock, setStock] = useState(() =>
    Object.fromEntries(INVENTORY_MASTER.map(i => [i.id, { qty: i.defaultQty, costPrice: i.costPrice, sellPrice: i.sellPrice, preferredStock: 10 }]))
  )
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(INVENTORY_MASTER.map(i => [i.id, { costPrice: i.costPrice, sellPrice: i.sellPrice }]))
  )
  // Restock entries
  const [restock, setRestock] = useState(() =>
    Object.fromEntries(INVENTORY_MASTER.map(i => [i.id, { qty: '', totalCost: '' }]))
  )
  const [newItem, setNewItem] = useState({ name: '', unit: '', category: 'kitchen', costPrice: '', sellPrice: '' })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  // Load live data from D1 on mount — without this, the screen always showed
  // hardcoded INVENTORY_MASTER defaults regardless of what was actually saved.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const rows = await api.getInventory('dwarka')
        if (!cancelled && Array.isArray(rows) && rows.length) {
          setStock(s => {
            const next = { ...s }
            rows.forEach(r => {
              next[r.item_id] = {
                qty: r.qty_in_stock ?? next[r.item_id]?.qty ?? 0,
                costPrice: r.cost_price ?? next[r.item_id]?.costPrice ?? 0,
                sellPrice: r.sell_price ?? next[r.item_id]?.sellPrice ?? 0,
                preferredStock: r.preferred_stock ?? next[r.item_id]?.preferredStock ?? 10,
              }
            })
            return next
          })
          setPrices(p => {
            const next = { ...p }
            rows.forEach(r => {
              next[r.item_id] = {
                costPrice: r.cost_price ?? next[r.item_id]?.costPrice ?? 0,
                sellPrice: r.sell_price ?? next[r.item_id]?.sellPrice ?? 0,
              }
            })
            return next
          })
        }
      } catch {
        // DB read failed — keep hardcoded defaults, no need to alarm the user on load
      }
      try {
        const log = await api.getInventoryRestockLog?.('dwarka')
        if (!cancelled && Array.isArray(log)) setRestockLog(log)
      } catch { /* non-critical */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])


  const filtered = cat === 'all' ? INVENTORY_MASTER : INVENTORY_MASTER.filter(i => i.category === cat)

  const setStockQty = (id, qty) => setStock(s => ({ ...s, [id]: { ...s[id], qty: Math.max(0, parseInt(qty) || 0) } }))
  const setPrice    = (id, field, val) => setPrices(p => ({ ...p, [id]: { ...p[id], [field]: parseFloat(val) || 0 } }))
  const setRestockField = (id, field, val) => {
    setRestock(r => {
      const next = { ...r[id], [field]: val }
      // Auto calc price/unit when both qty and cost filled
      if (next.qty && next.totalCost) {
        next.pricePerUnit = (parseFloat(next.totalCost) / parseFloat(next.qty)).toFixed(2)
      }
      return { ...r, [id]: next }
    })
  }

  const handleSaveStock = async () => {
    setSaving(true)
    try {
      const payload = Object.fromEntries(
        INVENTORY_MASTER.map(i => [i.id, { qty: stock[i.id]?.qty ?? 0, name: i.name }])
      )
      await api.saveInventoryStock({ villaId: 'dwarka', stock: payload })
      showToast('Stock saved ✓')
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const handleSavePrices = async () => {
    setSaving(true)
    try {
      await api.saveInventoryPrices({ villaId: 'dwarka', prices })
      showToast('Prices saved ✓')
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const handleSaveRestock = async () => {
    const entries = INVENTORY_MASTER
      .filter(i => restock[i.id]?.qty && parseFloat(restock[i.id].qty) > 0)
      .map(i => ({ id: i.id, name: i.name, ...restock[i.id] }))
    if (!entries.length) { showToast('Enter qty for at least one item', 'error'); return }
    setSaving(true)
    try {
      await api.saveInventoryRestock({ villaId: 'dwarka', entries })
      // Update local stock
      entries.forEach(e => {
        setStock(s => ({ ...s, [e.id]: { ...s[e.id], qty: (s[e.id]?.qty || 0) + parseFloat(e.qty) } }))
      })
      setRestock(r => Object.fromEntries(Object.keys(r).map(k => [k, { qty: '', totalCost: '' }])))
      showToast('Restock recorded ✓')
      // Pull the fresh log so the new entries show up immediately
      try {
        const log = await api.getInventoryRestockLog?.('dwarka')
        if (Array.isArray(log)) setRestockLog(log)
      } catch { /* non-critical */ }
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const tabBar = { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111', marginBottom: 0 }
  const tabBase = { flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', letterSpacing: '0.3px', transition: 'all 0.2s', textAlign: 'center' }
  const tabA = (t) => tab === t
    ? { ...tabBase, background: 'rgba(200,144,58,0.1)', color: '#C8903A', borderBottom: '2px solid #C8903A' }
    : { ...tabBase, background: 'transparent', color: '#5C7080', borderBottom: '2px solid transparent' }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Inventory</div>
          <div className="topbar-sub">DWARKA · STOCK & PRICING{loading ? ' · loading…' : ''}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabBar}>
        <button style={tabA('stock')}   onClick={() => setTab('stock')}>📦 Stock</button>
        <button style={tabA('prices')}  onClick={() => setTab('prices')}>💰 Prices</button>
        <button style={tabA('restock')} onClick={() => setTab('restock')}>➕ Restock</button>
      </div>

      <div className="screen-body">

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
          {CATEGORIES.map(c => (
            <button key={c.id}
              onClick={() => setCat(c.id)}
              style={{
                padding: '5px 12px', borderRadius: '20px', border: '1px solid',
                borderColor: cat === c.id ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                background: cat === c.id ? 'rgba(200,144,58,0.15)' : 'transparent',
                color: cat === c.id ? 'var(--gold)' : 'var(--text-dim)',
                fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{c.label}</button>
          ))}
        </div>

        {/* ── STOCK TAB ──────────────────────────────────── */}
        {tab === 'stock' && (
          <>
            <div className="card-section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              CURRENT STOCK
              <span style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => navigate('/owner/villa/inventory/preferred-stock')}
                  style={{ background: 'transparent', border: 'none', color: '#C8903A', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}>
                  ⚙ preferred levels
                </button>
                <span style={{ color: '#5C7080', fontWeight: 400, fontSize: '0.7rem' }}>tap qty to edit</span>
              </span>
            </div>
            <div className="card">
              {filtered.map((item, i) => {
                const s = stock[item.id] || {}
                const preferred = s.preferredStock ?? 10
                const threshold = Math.ceil(preferred * 0.1)
                const isLow = preferred > 0 && s.qty <= threshold
                return (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingBottom: '12px', marginBottom: '12px',
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border-dim)' : 'none',
                  }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontSize: '0.88rem', fontWeight: '500' }}>
                        {item.name}
                        {isLow && <span style={{ color: '#EF9A9A', fontSize: '0.7rem', marginLeft: '6px' }}>⚠️ Low (target {preferred})</span>}
                      </div>
                      <div style={{ color: '#5C7080', fontSize: '0.72rem' }}>
                        per {item.unit}
                        {prices[item.id]?.sellPrice > 0 && ` · sell ₹${prices[item.id].sellPrice}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => setStockQty(item.id, s.qty - 1)}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer' }}>−</button>
                      <input
                        type="number"
                        value={s.qty}
                        onChange={e => setStockQty(item.id, e.target.value)}
                        style={{ width: 40, textAlign: 'center', background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '6px', color: isLow ? '#EF9A9A' : 'var(--gold)', fontWeight: '700', fontSize: '0.9rem', padding: '4px' }}
                      />
                      <button onClick={() => setStockQty(item.id, s.qty + 1)}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <button className="btn btn-gold" onClick={handleSaveStock} disabled={saving}>
              {saving ? 'Saving...' : 'Save stock →'}
            </button>
          </>
        )}

        {/* ── PRICES TAB ─────────────────────────────────── */}
        {tab === 'prices' && (
          <>
            <div className="card-section-label">SELL PRICES (used at checkout)</div>
            <div className="card">
              {filtered.map((item, i) => (
                <div key={item.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: '8px', alignItems: 'center',
                  paddingBottom: '12px', marginBottom: '12px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-dim)' : 'none',
                }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: '500' }}>{item.name}</div>
                    <div style={{ color: '#5C7080', fontSize: '0.7rem' }}>per {item.unit}</div>
                  </div>
                  <div>
                    <div style={{ color: '#5C7080', fontSize: '0.65rem', marginBottom: '2px' }}>COST</div>
                    <input type="number" placeholder="0"
                      value={prices[item.id]?.costPrice || ''}
                      onChange={e => setPrice(item.id, 'costPrice', e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-dim)', borderRadius: '6px', color: '#EF9A9A', fontWeight: '600', fontSize: '0.85rem', padding: '5px 6px', textAlign: 'right' }} />
                  </div>
                  <div>
                    <div style={{ color: '#5C7080', fontSize: '0.65rem', marginBottom: '2px' }}>SELL</div>
                    <input type="number" placeholder="0"
                      value={prices[item.id]?.sellPrice || ''}
                      onChange={e => setPrice(item.id, 'sellPrice', e.target.value)}
                      style={{ width: '100%', background: 'rgba(200,144,58,0.06)', border: '1px solid rgba(200,144,58,0.25)', borderRadius: '6px', color: 'var(--gold)', fontWeight: '700', fontSize: '0.85rem', padding: '5px 6px', textAlign: 'right' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ color: '#5C7080', fontSize: '0.75rem', marginBottom: '12px', padding: '0 4px' }}>
              💡 Sell prices auto-populate at checkout when Raman enters quantities
            </div>
            <button className="btn btn-gold" onClick={handleSavePrices} disabled={saving}>
              {saving ? 'Saving...' : 'Save prices →'}
            </button>
          </>
        )}

        {/* ── RESTOCK TAB ────────────────────────────────── */}
        {tab === 'restock' && (
          <>
            <div className="card-section-label">ENTER QUANTITIES PURCHASED</div>
            <div style={{ color: '#5C7080', fontSize: '0.75rem', marginBottom: '10px', padding: '0 4px' }}>
              Enter qty bought + total cost → price/unit is auto-calculated
            </div>
            <div className="card">
              {filtered.map((item, i) => {
                const r = restock[item.id] || {}
                return (
                  <div key={item.id} style={{
                    paddingBottom: '14px', marginBottom: '14px',
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border-dim)' : 'none',
                  }}>
                    <div style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: '500', marginBottom: '6px' }}>
                      {item.name} <span style={{ color: '#5C7080', fontSize: '0.7rem' }}>· per {item.unit}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '6px' }}>
                      <div>
                        <div style={{ color: '#5C7080', fontSize: '0.65rem', marginBottom: '2px' }}>QTY BOUGHT</div>
                        <input type="number" placeholder="0"
                          value={r.qty || ''}
                          onChange={e => setRestockField(item.id, 'qty', e.target.value)}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-dim)', borderRadius: '6px', color: 'var(--gold)', fontWeight: '600', fontSize: '0.85rem', padding: '6px 8px' }} />
                      </div>
                      <div>
                        <div style={{ color: '#5C7080', fontSize: '0.65rem', marginBottom: '2px' }}>TOTAL COST (₹)</div>
                        <input type="number" placeholder="0"
                          value={r.totalCost || ''}
                          onChange={e => setRestockField(item.id, 'totalCost', e.target.value)}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-dim)', borderRadius: '6px', color: '#EF9A9A', fontWeight: '600', fontSize: '0.85rem', padding: '6px 8px' }} />
                      </div>
                      <div>
                        <div style={{ color: '#5C7080', fontSize: '0.65rem', marginBottom: '2px' }}>₹/UNIT</div>
                        <div style={{ background: 'rgba(52,168,83,0.06)', border: '1px solid rgba(52,168,83,0.15)', borderRadius: '6px', color: '#34A853', fontWeight: '700', fontSize: '0.85rem', padding: '6px 8px', textAlign: 'center' }}>
                          {r.pricePerUnit ? `₹${r.pricePerUnit}` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add new item */}
            {addNew ? (
              <div className="card">
                <div style={{ color: 'var(--gold)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '10px' }}>NEW ITEM</div>
                <div className="grid-2">
                  <div className="field">
                    <label className="field-label">Item name</label>
                    <input className="field-input" placeholder="e.g. Coffee pods"
                      value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="field-label">Unit</label>
                    <input className="field-input" placeholder="e.g. packet"
                      value={newItem.unit} onChange={e => setNewItem(n => ({ ...n, unit: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="field-label">Category</label>
                    <select className="field-input" value={newItem.category}
                      onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))}>
                      <option value="kitchen">Kitchen</option>
                      <option value="bathroom">Bathroom</option>
                      <option value="bedroom">Bedroom</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Sell price (₹)</label>
                    <input className="field-input gold" type="number" placeholder="0"
                      value={newItem.sellPrice} onChange={e => setNewItem(n => ({ ...n, sellPrice: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-gold" style={{ flex: 1 }}
                    onClick={() => { showToast(`${newItem.name} added ✓`); setAddNew(false); setNewItem({ name: '', unit: '', category: 'kitchen', costPrice: '', sellPrice: '' }) }}>
                    Add item
                  </button>
                  <button onClick={() => setAddNew(false)}
                    style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-dim)', background: 'transparent', color: '#5C7080', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddNew(true)}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px dashed rgba(200,144,58,0.3)', background: 'transparent', color: '#C8903A', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '8px' }}>
                + Add new item to inventory
              </button>
            )}

            <button className="btn btn-teal" onClick={handleSaveRestock} disabled={saving}>
              {saving ? 'Saving...' : 'Record restock →'}
            </button>

            {restockLog.length > 0 && (
              <>
                <div className="card-section-label" style={{ marginTop: '18px' }}>RECENT RESTOCKS</div>
                <div className="card">
                  {restockLog.slice(0, 10).map((r, i) => (
                    <div key={r.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      paddingBottom: '10px', marginBottom: '10px',
                      borderBottom: i < Math.min(restockLog.length, 10) - 1 ? '1px solid var(--border-dim)' : 'none',
                    }}>
                      <div>
                        <div style={{ color: 'var(--text)', fontSize: '0.82rem', fontWeight: '500' }}>{r.item_name}</div>
                        <div style={{ color: '#5C7080', fontSize: '0.68rem' }}>{r.qty_bought} units · {fmt(r.total_cost)} · {r.created_at}</div>
                      </div>
                      <div style={{ color: '#34A853', fontSize: '0.8rem', fontWeight: '600' }}>{fmt(r.price_per_unit)}/unit</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
