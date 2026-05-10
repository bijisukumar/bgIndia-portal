import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const ITEMS = [
  { name:'Water bottles', unit:'per bottle', price:30 },
  { name:'Soft drinks', unit:'per can', price:60 },
  { name:'Tea/Coffee', unit:'per cup', price:25 },
  { name:'Snacks', unit:'per plate', price:150 },
  { name:'Milk', unit:'per litre', price:70 },
  { name:'Eggs', unit:'per egg', price:12 },
  { name:'Bread', unit:'per loaf', price:45 },
  { name:'Gas cylinder', unit:'per cylinder', price:950 },
  { name:'Other', unit:'custom', price:0 },
]

export default function KitchenIncidentals() {
  const navigate  = useNavigate()
  const [stay, setStay]     = useState(null)
  const [cart, setCart]     = useState({})
  const [custom, setCustom] = useState({ name:'', price:0, qty:1 })
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }

  useEffect(() => {
    api.getActiveStay('dwarka').then(s => { if(s?.stayId) setStay(s) })
  }, [])

  const setQty = (name, qty) => setCart(c => ({ ...c, [name]: Math.max(0, qty) }))
  const total  = ITEMS.reduce((s,i) => s + (cart[i.name]||0) * i.price, 0)
             + (cart['Other']||0) * (parseFloat(custom.price)||0)

  const handleSave = async () => {
    const items = ITEMS
      .filter(i => (cart[i.name]||0) > 0)
      .map(i => ({
        name: i.name === 'Other' ? (custom.name||'Other') : i.name,
        qty: cart[i.name],
        price: i.name === 'Other' ? parseFloat(custom.price)||0 : i.price,
        subtotal: (cart[i.name]||0) * (i.name === 'Other' ? parseFloat(custom.price)||0 : i.price),
      }))
    if (!items.length) { showToast('Add at least one item','error'); return }
    setSaving(true)
    try {
      await api.saveKitchenEntry({ stayId: stay?.stayId, guestName: stay?.guestName, items, totalAmount: total, notes })
      showToast('Kitchen entry saved ✓')
      setCart({}); setNotes('')
    } catch { showToast('Failed to save','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">Kitchen incidentals</div><div className="topbar-sub">{stay?.guestName || 'No active stay'}</div></div>
        <div style={{width:34}}/>
      </div>
      <div className="screen-body">
        {!stay ? (
          <div className="card" style={{textAlign:'center',padding:'32px',color:'var(--text-dim)'}}>No active stay — check in a guest first</div>
        ) : (
          <>
            <div className="card-section-label">ADD ITEMS</div>
            <div className="card">
              {ITEMS.map((item, i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  paddingBottom:'12px',marginBottom:'12px',borderBottom:i<ITEMS.length-1?'1px solid var(--border-dim)':'none'}}>
                  <div>
                    <div style={{color:'var(--text)',fontSize:'0.88rem',fontWeight:'500'}}>{item.name}</div>
                    <div style={{color:'var(--text-dim)',fontSize:'0.75rem'}}>{item.unit} {item.price>0?`· ₹${item.price}`:''}</div>
                    {item.name==='Other' && (cart['Other']||0)>0 && (
                      <div style={{display:'flex',gap:'6px',marginTop:'6px'}}>
                        <input className="field-input" placeholder="Item name" value={custom.name}
                          onChange={e=>setCustom(c=>({...c,name:e.target.value}))} style={{fontSize:'0.78rem',padding:'4px 8px'}}/>
                        <input className="field-input" placeholder="₹" type="number" value={custom.price}
                          onChange={e=>setCustom(c=>({...c,price:e.target.value}))} style={{fontSize:'0.78rem',padding:'4px 8px',width:'70px'}}/>
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <button onClick={()=>setQty(item.name,(cart[item.name]||0)-1)}
                      style={{width:28,height:28,borderRadius:'50%',border:'1px solid var(--border-dim)',
                        background:'transparent',color:'var(--text)',fontSize:'1.1rem',cursor:'pointer',lineHeight:'1'}}>−</button>
                    <span style={{color:'var(--gold)',fontWeight:'700',minWidth:'20px',textAlign:'center'}}>{cart[item.name]||0}</span>
                    <button onClick={()=>setQty(item.name,(cart[item.name]||0)+1)}
                      style={{width:28,height:28,borderRadius:'50%',border:'1px solid var(--border-dim)',
                        background:'transparent',color:'var(--text)',fontSize:'1.1rem',cursor:'pointer',lineHeight:'1'}}>+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="field" style={{marginBottom:0}}>
                <div className="field-label">Notes (optional)</div>
                <input className="field-input" placeholder="Any notes..." value={notes} onChange={e=>setNotes(e.target.value)}/>
              </div>
            </div>
            <div className="net-box">
              <div className="net-row">
                <span style={{color:'var(--text)',fontWeight:'700',fontSize:'1rem'}}>Total</span>
                <span className="net-val big">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <button className="btn btn-gold" onClick={handleSave} disabled={saving||total===0}>
              {saving ? 'Saving...' : `Save entry · ₹${total.toLocaleString('en-IN')}`}
            </button>
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
