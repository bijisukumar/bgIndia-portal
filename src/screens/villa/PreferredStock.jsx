import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

// Preferred Stock Settings — lets the owner set a target stock level per item.
// The Inventory Stock tab and dashboard flag an item as "low" once
// qty_in_stock falls to <= 10% of this preferred level.
//
// Item list now comes from getInventory (active=1 rows) instead of the old
// hardcoded INVENTORY_MASTER import — so archived items disappear here too,
// and newly-added items show up automatically with no code change.
export default function PreferredStock() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])     // [{id, name, unit}]
  const [levels, setLevels] = useState({})
  const [current, setCurrent] = useState({})  // item_id -> qty_in_stock, for context while editing
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    let cancelled = false
    api.getInventory('dwarka').then(rows => {
      if (cancelled || !Array.isArray(rows)) return
      setItems(rows.map(r => ({ id: r.item_id, name: r.name, unit: r.unit || 'unit' })))
      setLevels(Object.fromEntries(rows.map(r => [r.item_id, r.preferred_stock ?? 10])))
      setCurrent(Object.fromEntries(rows.map(r => [r.item_id, r.qty_in_stock ?? 0])))
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const setLevel = (id, val) => setLevels(l => ({ ...l, [id]: Math.max(0, parseInt(val, 10) || 0) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await api.saveInventoryPreferredStock({ villaId: 'dwarka', levels })
      if (res?.errors?.length > 0) {
        const first = res.errors[0]
        showToast(`Saved ${res.savedCount}/${res.total} — "${first.itemId}" failed: ${first.error}`, 'error')
      } else {
        showToast('Preferred stock levels saved ✓')
      }
    } catch (e) { showToast(e?.message || 'Failed to save', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Preferred Stock Levels</div>
          <div className="topbar-sub">DWARKA · LOW-STOCK THRESHOLDS{loading ? ' · loading…' : ''}</div>
        </div>
      </div>

      <div className="screen-body">
        <div className="card" style={{ padding: '12px 14px', marginBottom: '14px', background: 'rgba(200,144,58,0.06)', border: '1px solid rgba(200,144,58,0.2)' }}>
          <div style={{ color: '#C8903A', fontSize: '0.78rem', lineHeight: 1.5 }}>
            💡 Set the stock level you'd like to maintain for each item. You'll get a low-stock
            warning once the current quantity falls to <strong>10% or less</strong> of this number
            (e.g. preferred 20 → warning at 2 or fewer left).
          </div>
        </div>

        <div className="card-section-label">ITEMS</div>
        <div className="card">
          {items.map((item, i) => {
            const preferred = levels[item.id] ?? 10
            const have      = current[item.id] ?? 0
            const threshold = Math.ceil(preferred * 0.1)
            const isLow     = preferred > 0 && have <= threshold
            return (
              <div key={item.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 90px', alignItems: 'center', gap: '10px',
                paddingBottom: '12px', marginBottom: '12px',
                borderBottom: i < items.length - 1 ? '1px solid var(--border-dim)' : 'none',
              }}>
                <div>
                  <div style={{ color: 'var(--text)', fontSize: '0.88rem', fontWeight: '500' }}>{item.name}</div>
                  <div style={{ color: isLow ? '#EF9A9A' : '#5C7080', fontSize: '0.72rem' }}>
                    {have} {item.unit}{have === 1 ? '' : 's'} in hand
                    {isLow && <span style={{ color: '#EF9A9A', fontWeight: '600' }}> · LOW (≤ {threshold})</span>}
                  </div>
                </div>
                <input
                  type="number" min="0" className="field-input"
                  value={preferred}
                  onChange={e => setLevel(item.id, e.target.value)}
                  style={{ textAlign: 'center', fontWeight: '700', color: 'var(--gold)' }}
                />
              </div>
            )
          })}
        </div>

        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save preferred stock →'}
        </button>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
