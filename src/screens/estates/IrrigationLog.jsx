// ============================================================
//  IrrigationLog.jsx — Zone-based irrigation logging
//  Replaces the Google Form approach
//  Route: /pollachi/irrigation
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const TODAY = new Date().toISOString().slice(0, 10)

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return d }
}

export default function IrrigationLog({ estate = 'pollachi' }) {
  const navigate = useNavigate()
  const [zones, setZones]       = useState([])
  const [selected, setSelected] = useState({}) // zone_id -> checked
  const [date, setDate]         = useState(TODAY)
  const [duration, setDuration] = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [history, setHistory]   = useState([])
  const [tab, setTab]           = useState('log') // 'log' | 'history'
  const [loadingHistory, setLoadingHistory] = useState(false)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  useEffect(() => { loadZones() }, [estate])
  useEffect(() => { if (tab === 'history') loadHistory() }, [tab])

  async function loadZones() {
    try {
      const d = await api.getIrrigationZoneHealth(estate)
      setZones(d?.zones || [])
    } catch(e) { setZones([]) }
  }

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const d = await api.getIrrigationHistory(estate)
      setHistory(Array.isArray(d) ? d : [])
    } catch(e) { setHistory([]) }
    finally { setLoadingHistory(false) }
  }

  function toggleZone(zoneId) {
    setSelected(s => ({...s, [zoneId]: !s[zoneId]}))
  }

  function selectAll() {
    const all = {}
    zones.forEach(z => { all[z.zone_id] = true })
    setSelected(all)
  }

  const selectedZones = zones.filter(z => selected[z.zone_id])

  async function handleSave() {
    if (selectedZones.length === 0) { showToast('Select at least one zone', 'error'); return }
    setSaving(true)
    try {
      await Promise.all(selectedZones.map(z =>
        api.saveIrrigationZoneLog({
          estate,
          zoneId:       z.zone_id,
          zoneName:     z.zone_name,
          loggedDate:   date,
          durationMins: parseInt(duration) || 0,
          notes:        notes.trim() || null,
        })
      ))
      showToast(`✅ Logged irrigation for ${selectedZones.length} zone${selectedZones.length>1?'s':''}`)
      setSelected({})
      setNotes('')
      setDuration('')
      loadZones() // refresh zone health
    } catch(e) { showToast('Save failed: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  const STATUS_COLOR = { ok:'#34A853', warn:'#F59E0B', alert:'#EA7020', critical:'#EF4444', never:'#EF4444', unknown:'#5C7080' }
  const STATUS_LABEL = { ok:'✅ On track', warn:'⚠️ 1 miss', alert:'🟠 2 misses', critical:'🔴 Overdue', never:'🔴 Never', unknown:'—' }

  const tabBtn = (t, label) => ({
    flex:1, padding:'10px', border:'none', cursor:'pointer', fontWeight:'600',
    fontSize:'0.8rem', background: tab===t ? 'rgba(24,95,165,0.15)' : 'transparent',
    color: tab===t ? '#85B7EB' : '#5C7080',
    borderBottom: tab===t ? '2px solid #185FA5' : '2px solid transparent',
  })

  const INP = { width:'100%', padding:'9px 12px', borderRadius:'8px', boxSizing:'border-box', background:'var(--dark-input)', border:'1px solid var(--border-dim)', color:'var(--text)', fontSize:'0.9rem' }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Irrigation log</div>
          <div className="topbar-sub">POLLACHI ESTATE · ZONE TRACKING</div>
        </div>
      </div>

      <div style={{display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#111'}}>
        <button style={tabBtn('log')} onClick={()=>setTab('log')}>💧 Log irrigation</button>
        <button style={tabBtn('history')} onClick={()=>setTab('history')}>📋 History</button>
      </div>

      <div className="screen-body">

        {tab === 'log' && (
          <>
            {/* Date + duration */}
            <div className="card-section-label">IRRIGATION DATE</div>
            <div className="card" style={{marginBottom:'12px'}}>
              <div className="grid-2">
                <div>
                  <label style={{display:'block', fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px'}}>DATE</label>
                  <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={INP}/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px'}}>DURATION (MINS)</label>
                  <input type="number" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="e.g. 45" style={INP}/>
                </div>
              </div>
              <div style={{marginTop:'10px'}}>
                <label style={{display:'block', fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px'}}>NOTES</label>
                <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any issues, pump problems, partial zones…" style={INP}/>
              </div>
            </div>

            {/* Zone selector */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
              <div className="card-section-label" style={{marginBottom:0}}>SELECT ZONES ({selectedZones.length}/{zones.length})</div>
              <button onClick={selectAll} style={{fontSize:'0.72rem', color:'#185FA5', background:'transparent', border:'none', cursor:'pointer', padding:'4px 8px'}}>
                Select all
              </button>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px'}}>
              {zones.map(z => {
                const isSelected = !!selected[z.zone_id]
                const sc = STATUS_COLOR[z.status]
                return (
                  <div key={z.zone_id} onClick={()=>toggleZone(z.zone_id)} style={{
                    padding:'10px 12px', borderRadius:'10px', cursor:'pointer', userSelect:'none',
                    border: isSelected ? '2px solid #185FA5' : `1px solid ${sc}40`,
                    background: isSelected ? 'rgba(24,95,165,0.15)' : `${sc}08`,
                    transition:'all 0.15s',
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px'}}>
                      <div style={{
                        width:'18px', height:'18px', borderRadius:'4px',
                        border: isSelected ? '2px solid #185FA5' : '2px solid rgba(255,255,255,0.2)',
                        background: isSelected ? '#185FA5' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      }}>
                        {isSelected && <span style={{color:'#fff', fontSize:'11px', fontWeight:'bold'}}>✓</span>}
                      </div>
                      <span style={{fontWeight:'700', fontSize:'0.85rem', color: isSelected?'#85B7EB':'#EDF2F7'}}>
                        Zone {z.zone_label}
                      </span>
                    </div>
                    <div style={{fontSize:'0.68rem', color: sc, marginBottom:'2px'}}>{STATUS_LABEL[z.status]}</div>
                    <div style={{fontSize:'0.65rem', color:'#5C7080'}}>
                      {z.days_since !== null ? `Last: ${z.days_since}d ago` : 'Never logged'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary of selected */}
            {selectedZones.length > 0 && (
              <div style={{background:'rgba(24,95,165,0.08)', border:'1px solid rgba(24,95,165,0.25)', borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', fontSize:'0.78rem', color:'#85B7EB'}}>
                Logging irrigation for: {selectedZones.map(z=>`Zone ${z.zone_label}`).join(', ')}
              </div>
            )}

            <button className="btn btn-gold" onClick={handleSave} disabled={saving || selectedZones.length === 0}
              style={{opacity: selectedZones.length === 0 ? 0.5 : 1}}>
              {saving ? 'Saving…' : `💧 Save irrigation log${selectedZones.length > 1 ? ` (${selectedZones.length} zones)` : ''}`}
            </button>
          </>
        )}

        {tab === 'history' && (
          <>
            {loadingHistory && <div style={{textAlign:'center', color:'#5C7080', padding:'24px', fontSize:'0.82rem'}}>Loading…</div>}
            {!loadingHistory && history.length === 0 && (
              <div style={{textAlign:'center', padding:'32px', color:'#5C7080', fontSize:'0.82rem', border:'1px dashed rgba(255,255,255,0.08)', borderRadius:'12px'}}>
                No irrigation logs yet.<br/>
                <span style={{fontSize:'0.75rem'}}>Use the Log tab to record zone irrigation.</span>
              </div>
            )}
            {history.map((h,i) => (
              <div key={i} style={{background:'var(--dark-card)', border:'1px solid var(--border-dim)', borderRadius:'10px', padding:'10px 14px', marginBottom:'6px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:'600', fontSize:'0.85rem', color:'#85B7EB'}}>{fmtDate(h.logged_date)}</div>
                  <div style={{fontSize:'0.72rem', color:'#5C7080', marginTop:'2px'}}>
                    {h.zone_name || `Zone ${h.zone_id}`}
                    {h.duration_mins > 0 && ` · ${h.duration_mins} min`}
                    {h.notes && ` · ${h.notes}`}
                  </div>
                </div>
                <div style={{fontSize:'0.7rem', color:'#34A853'}}>💧</div>
              </div>
            ))}
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
