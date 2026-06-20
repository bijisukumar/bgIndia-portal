// ============================================================
//  MangoHarvest.jsx — Per-variety box tracking
//  Matches spreadsheet: Normal/Small, 7 varieties
//  Route: /pollachi/mango
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { parseLocalDate, localTodayStr } from '../../utils/dates'

const TODAY    = localTodayStr()
const VARIETIES = ['alphonsa','neelam','malgova','banganapally','kilimooku','sindooram','mix']
const VAR_LABEL = { alphonsa:'Alphonsa', neelam:'Neelam', malgova:'Malgova', banganapally:'Banganapally', kilimooku:'Kilimooku', sindooram:'Sindooram', mix:'Mix' }
const VAR_COLOR = { alphonsa:'#F59E0B', neelam:'#34A853', malgova:'#C8903A', banganapally:'#F59E0B', kilimooku:'#8B5CF6', sindooram:'#EF4444', mix:'#5C7080' }

const EMPTY_FORM = { date:TODAY, boxType:'Normal', buyer:'', pricePerBox:'', notes:'', alphonsa:0, neelam:0, malgova:0, banganapally:0, kilimooku:0, sindooram:0, mix:0 }

function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return d }
}

export default function MangoHarvest({ estate = 'pollachi' }) {
  const navigate   = useNavigate()
  const [tab, setTab]       = useState('add')
  const [form, setForm]     = useState({...EMPTY_FORM})
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const setVar = (v, val) => setForm(f=>({...f,[v]: Math.max(0, parseInt(val)||0)}))

  useEffect(() => { if (tab==='history') loadHistory() }, [tab])

  async function loadHistory() {
    setLoading(true)
    try {
      const d = await api.getMangoHarvests(estate)
      const rows = Array.isArray(d) ? d : []
      setRecords(rows)
      // Compute summary totals per variety
      const totals = { alphonsa:0, neelam:0, malgova:0, banganapally:0, kilimooku:0, sindooram:0, mix:0, total:0, normal:0, small:0 }
      rows.forEach(r => {
        VARIETIES.forEach(v => { totals[v] += r[v]||0 })
        totals.total += r.total_boxes||0
        if (r.box_type==='Normal') totals.normal += r.total_boxes||0
        else totals.small += r.total_boxes||0
      })
      setSummary(totals)
    } catch(e) { setRecords([]) }
    finally { setLoading(false) }
  }

  const totalBoxes = VARIETIES.reduce((s,v)=>s+(parseInt(form[v])||0), 0)
  const totalRevenue = totalBoxes * (parseFloat(form.pricePerBox)||0)

  async function handleSave() {
    if (!form.date) { showToast('Date required', 'error'); return }
    if (totalBoxes === 0) { showToast('Enter at least one box count', 'error'); return }
    setSaving(true)
    try {
      await api.saveMangoHarvest({
        estate, harvestDate: form.date, boxType: form.boxType,
        buyer: form.buyer.trim()||null, pricePerBox: parseFloat(form.pricePerBox)||0,
        totalRevenue, totalBoxes, notes: form.notes.trim()||null,
        ...Object.fromEntries(VARIETIES.map(v=>[v, parseInt(form[v])||0]))
      })
      showToast(`✅ Saved — ${totalBoxes} boxes (${form.boxType})`)
      setForm({...EMPTY_FORM})
    } catch(e) { showToast('Save failed: '+e.message, 'error') }
    finally { setSaving(false) }
  }

  const tabBtn = (t,label) => ({
    flex:1, padding:'10px', border:'none', cursor:'pointer', fontWeight:'600',
    fontSize:'0.8rem', background: tab===t?'rgba(245,158,11,0.12)':'transparent',
    color: tab===t?'#F59E0B':'#5C7080',
    borderBottom: tab===t?'2px solid #F59E0B':'2px solid transparent',
  })

  const INP = {width:'100%', padding:'9px 12px', borderRadius:'8px', boxSizing:'border-box', background:'var(--dark-input)', border:'1px solid var(--border-dim)', color:'var(--text)', fontSize:'0.9rem'}

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Mango harvest</div>
          <div className="topbar-sub">POLLACHI ESTATE · BOX TRACKING</div>
        </div>
      </div>

      <div style={{display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#111'}}>
        <button style={tabBtn('add')} onClick={()=>setTab('add')}>🥭 Add entry</button>
        <button style={tabBtn('history')} onClick={()=>setTab('history')}>📋 History & totals</button>
      </div>

      <div className="screen-body">

        {tab==='add' && (
          <>
            {/* Date, type, buyer */}
            <div className="card" style={{marginBottom:'12px'}}>
              <div className="grid-2">
                <div>
                  <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>DATE</label>
                  <input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={INP}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>BOX TYPE</label>
                  <select value={form.boxType} onChange={e=>set('boxType',e.target.value)} style={INP}>
                    <option>Normal</option>
                    <option>Small</option>
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>BUYER</label>
                  <input value={form.buyer} onChange={e=>set('buyer',e.target.value)} placeholder="Sidiq, local market…" style={INP}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>PRICE / BOX (₹)</label>
                  <input type="number" value={form.pricePerBox} onChange={e=>set('pricePerBox',e.target.value)} placeholder="0" style={{...INP,color:'#34A853'}}/>
                </div>
              </div>
            </div>

            {/* Variety counts */}
            <div className="card-section-label">BOXES BY VARIETY</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px'}}>
              {VARIETIES.map(v => (
                <div key={v} style={{background:'var(--dark-card)', border:`1px solid ${VAR_COLOR[v]}30`, borderRadius:'10px', padding:'10px 12px'}}>
                  <label style={{display:'block', fontSize:'0.7rem', color:VAR_COLOR[v], letterSpacing:'1px', marginBottom:'6px', fontWeight:'600'}}>
                    {VAR_LABEL[v].toUpperCase()}
                  </label>
                  <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                    <button onClick={()=>setVar(v,(form[v]||0)-1)}
                      style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#EDF2F7',fontSize:'1rem',cursor:'pointer',flexShrink:0}}>−</button>
                    <input type="number" min="0" value={form[v]||0} onChange={e=>setVar(v,e.target.value)}
                      style={{flex:1,textAlign:'center',padding:'6px',borderRadius:'6px',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color: form[v]>0?VAR_COLOR[v]:'var(--text)',fontSize:'1rem',fontWeight:'700'}}/>
                    <button onClick={()=>setVar(v,(form[v]||0)+1)}
                      style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#EDF2F7',fontSize:'1rem',cursor:'pointer',flexShrink:0}}>+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total summary */}
            <div style={{background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'10px', padding:'12px 14px', marginBottom:'12px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'0.62rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'4px'}}>TOTAL BOXES</div>
                  <div style={{fontWeight:'700', color:'#F59E0B', fontSize:'1.4rem'}}>{totalBoxes}</div>
                </div>
                {totalRevenue > 0 && (
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'0.62rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'4px'}}>TOTAL REVENUE</div>
                    <div style={{fontWeight:'700', color:'#34A853', fontSize:'1.2rem'}}>₹{totalRevenue.toLocaleString('en-IN')}</div>
                  </div>
                )}
              </div>
              {totalBoxes > 0 && (
                <div style={{marginTop:'8px', display:'flex', gap:'6px', flexWrap:'wrap'}}>
                  {VARIETIES.filter(v=>form[v]>0).map(v=>(
                    <span key={v} style={{fontSize:'0.7rem', color:VAR_COLOR[v], background:`${VAR_COLOR[v]}15`, padding:'2px 8px', borderRadius:'8px', border:`1px solid ${VAR_COLOR[v]}30`}}>
                      {VAR_LABEL[v]}: {form[v]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>NOTES</label>
              <input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Quality notes, pickup details…" style={INP}/>
            </div>

            <button className="btn btn-gold" onClick={handleSave} disabled={saving||totalBoxes===0}
              style={{marginTop:'12px', opacity:totalBoxes===0?0.5:1}}>
              {saving?'Saving…':`🥭 Save — ${totalBoxes} ${form.boxType} boxes`}
            </button>
          </>
        )}

        {tab==='history' && (
          <>
            {/* Season summary */}
            {summary && summary.total > 0 && (
              <div style={{background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'12px', padding:'14px', marginBottom:'14px'}}>
                <div style={{fontSize:'0.62rem', color:'#F59E0B', letterSpacing:'2px', marginBottom:'10px'}}>2026 SEASON TOTALS</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'10px'}}>
                  {[
                    {label:'TOTAL BOXES', val:summary.total, color:'#F59E0B'},
                    {label:'NORMAL',      val:summary.normal, color:'#C8903A'},
                    {label:'SMALL',       val:summary.small,  color:'#5C7080'},
                  ].map(k=>(
                    <div key={k.label} style={{textAlign:'center'}}>
                      <div style={{fontSize:'0.58rem', color:'#5C7080', letterSpacing:'1px', marginBottom:'3px'}}>{k.label}</div>
                      <div style={{fontWeight:'700', color:k.color, fontSize:'1.1rem'}}>{k.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                  {VARIETIES.filter(v=>summary[v]>0).map(v=>(
                    <div key={v} style={{textAlign:'center', background:`${VAR_COLOR[v]}10`, border:`1px solid ${VAR_COLOR[v]}30`, borderRadius:'8px', padding:'5px 10px'}}>
                      <div style={{fontSize:'0.6rem', color:VAR_COLOR[v], letterSpacing:'0.5px'}}>{VAR_LABEL[v]}</div>
                      <div style={{fontWeight:'700', color:VAR_COLOR[v], fontSize:'0.9rem'}}>{summary[v]}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading && <div style={{textAlign:'center',color:'#5C7080',padding:'24px',fontSize:'0.82rem'}}>Loading…</div>}

            {!loading && records.length===0 && (
              <div style={{textAlign:'center',padding:'32px',color:'#5C7080',fontSize:'0.82rem',border:'1px dashed rgba(255,255,255,0.08)',borderRadius:'12px'}}>
                No records yet. Add entries from the "Add entry" tab.
              </div>
            )}

            {/* Group by date */}
            {!loading && (() => {
              const byDate = {}
              records.forEach(r => {
                const k = r.harvest_date
                if (!byDate[k]) byDate[k] = []
                byDate[k].push(r)
              })
              return Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).map(([date, rows]) => (
                <div key={date} style={{marginBottom:'10px'}}>
                  <div style={{fontSize:'0.75rem', color:'#C8903A', fontWeight:'700', marginBottom:'5px'}}>{fmtDate(date)}</div>
                  {rows.map((r,i) => (
                    <div key={i} style={{background:'var(--dark-card)', border:`1px solid rgba(245,158,11,0.15)`, borderRadius:'10px', padding:'10px 12px', marginBottom:'4px'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                        <span style={{fontSize:'0.8rem', fontWeight:'600', color: r.box_type==='Normal'?'#C8903A':'#5C7080'}}>{r.box_type}</span>
                        <span style={{fontWeight:'700', color:'#F59E0B', fontSize:'0.9rem'}}>{r.total_boxes} boxes</span>
                      </div>
                      <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
                        {VARIETIES.filter(v=>r[v]>0).map(v=>(
                          <span key={v} style={{fontSize:'0.68rem', color:VAR_COLOR[v], background:`${VAR_COLOR[v]}12`, padding:'1px 7px', borderRadius:'6px'}}>
                            {VAR_LABEL[v]}: {r[v]}
                          </span>
                        ))}
                      </div>
                      {r.total_revenue > 0 && (
                        <div style={{fontSize:'0.72rem', color:'#34A853', marginTop:'5px'}}>₹{r.total_revenue.toLocaleString('en-IN')}</div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            })()}
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
