// ============================================================
//  IrrigationLog.jsx — Zone-based irrigation logging
//  Replaces the Google Form approach
//  Route: /pollachi/irrigation
// ============================================================
import { useState, useEffect } from 'react'
import { useBack } from '../../utils/navTrail'
import { api } from '../../api'
import { parseLocalDate, localTodayStr } from '../../utils/dates'

const TODAY = localTodayStr()

function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return d }
}

export default function IrrigationLog({ estate = 'pollachi' }) {
  const goBack = useBack()
  const [zones, setZones]       = useState([])
  const [selected, setSelected] = useState({}) // zone_id -> checked
  const [date, setDate]         = useState(TODAY)
  const [duration, setDuration] = useState('')
  const [notes, setNotes]       = useState('')
  const [raining, setRaining]   = useState(false)   // rain watered every zone
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [history, setHistory]   = useState([])
  const [tab, setTab]           = useState('log') // 'log' | 'missing' | 'history'
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [missing, setMissing]   = useState(null)
  const [missDays, setMissDays] = useState(30)
  const [busyDay, setBusyDay]   = useState(null)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  useEffect(() => { loadZones() }, [estate])
  useEffect(() => { if (tab === 'history') loadHistory() }, [tab])
  useEffect(() => { if (tab === 'missing') loadMissing() }, [tab, missDays])

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

  async function loadMissing() {
    try { setMissing(await api.getIrrigationMissingDays(estate, missDays)) }
    catch(e) { setMissing(null) }
  }

  // The reason is optional: prompt returns '' when the box is left empty and
  // null when it is cancelled, and only a cancel should stop the approval.
  async function approveDay(day) {
    const reason = window.prompt(
      'Approving ' + fmtDate(day.date) + ' - no irrigation entry.' + String.fromCharCode(10) + String.fromCharCode(10) +
      'Reason (optional: rain, pump down, nobody on site). Leave blank to just mark it seen:', '')
    if (reason === null) return
    setBusyDay(day.date)
    try {
      await api.approveIrrigationMissedDay({ estate, date: day.date, reason })
      await loadMissing()
      showToast('Approved ' + fmtDate(day.date))
    } catch(e) { showToast(e?.message || 'Could not approve', 'error') }
    finally { setBusyDay(null) }
  }

  async function undoDay(day) {
    setBusyDay(day.date)
    try {
      await api.approveIrrigationMissedDay({ estate, date: day.date, undo: true })
      await loadMissing()
    } catch(e) { showToast(e?.message || 'Could not undo', 'error') }
    finally { setBusyDay(null) }
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

  // A rainy day waters everything: ticking the box selects every zone, unticking clears them.
  function toggleRaining(on) {
    setRaining(on)
    if (on) selectAll(); else setSelected({})
  }

  async function handleSave() {
    if (selectedZones.length === 0) { showToast('Select at least one zone', 'error'); return }
    setSaving(true)
    try {
      // One request, one summary email — not one per zone
      await api.saveIrrigationZoneLogs({
        estate,
        loggedDate:   date,
        durationMins: parseInt(duration) || 0,
        notes:        (raining ? ['Rain', notes.trim()].filter(Boolean).join(' — ') : notes.trim()) || null,
        zones:        selectedZones.map(z => ({ zoneId: z.zone_id, zoneName: z.zone_name })),
      })
      showToast(`✅ Logged irrigation for ${selectedZones.length} zone${selectedZones.length>1?'s':''}`)
      setSelected({})
      setRaining(false)
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
        <button className="back-btn" onClick={goBack}>‹</button>
        <div>
          <div className="topbar-title">Irrigation log</div>
          <div className="topbar-sub">POLLACHI ESTATE · ZONE TRACKING</div>
        </div>
      </div>

      <div style={{display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#111'}}>
        <button style={tabBtn('log')} onClick={()=>setTab('log')}>💧 Log irrigation</button>
        <button style={tabBtn('missing')} onClick={()=>setTab('missing')}>
          ⚠️ Missing days{missing?.outstanding ? ' (' + missing.outstanding + ')' : ''}
        </button>
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
              <label style={{display:'flex', alignItems:'center', gap:'10px', marginTop:'12px', cursor:'pointer', userSelect:'none', fontSize:'0.86rem', color: raining ? '#85B7EB' : 'var(--text)'}}>
                <input type="checkbox" checked={raining} onChange={e=>toggleRaining(e.target.checked)}
                  style={{width:'20px', height:'20px', accentColor:'#185FA5', flexShrink:0}}/>
                🌧 Raining — rain watered all zones
              </label>
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

        {tab === 'missing' && (
          <div>
            <div style={{display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap'}}>
              {[7, 30, 45, 90].map(d => (
                <button key={d} onClick={() => setMissDays(d)}
                  style={{padding:'6px 12px', borderRadius:'16px', cursor:'pointer', fontSize:'0.76rem',
                    border:'1px solid ' + (missDays===d ? 'rgba(200,144,58,0.5)' : 'rgba(255,255,255,0.1)'),
                    background: missDays===d ? 'rgba(200,144,58,0.15)' : 'transparent',
                    color: missDays===d ? '#C8903A' : 'var(--text-dim)', fontWeight: missDays===d ? 700 : 400}}>
                  {d} days
                </button>
              ))}
            </div>

            {!missing && <p style={{color:'var(--text-dim)', fontSize:'0.85rem'}}>Loading...</p>}

            {missing && missing.missing.length === 0 && (
              <p style={{color:'#34A853', fontSize:'0.88rem'}}>
                An entry on every one of the last {missing.days} days. Nothing missing.
              </p>
            )}

            {missing && missing.missing.length > 0 && (
              <>
                <p style={{color:'var(--text-dim)', fontSize:'0.8rem', marginBottom:'12px'}}>
                  {missing.loggedDays} day{missing.loggedDays===1?'':'s'} logged of the last {missing.days}.{' '}
                  <strong style={{color: missing.outstanding ? '#EF4444' : '#34A853'}}>
                    {missing.outstanding} still to look at
                  </strong>
                  {missing.missing.length - missing.outstanding > 0 &&
                    ', ' + (missing.missing.length - missing.outstanding) + ' approved'}.
                </p>

                <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                  {missing.missing.map(day => (
                    <div key={day.date}
                      style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px',
                        borderRadius:'10px',
                        background: day.approved ? 'rgba(52,168,83,0.06)' : 'rgba(239,68,68,0.06)',
                        border:'1px solid ' + (day.approved ? 'rgba(52,168,83,0.25)' : 'rgba(239,68,68,0.25)')}}>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontWeight:600, fontSize:'0.88rem'}}>{fmtDate(day.date)}</div>
                        <div style={{fontSize:'0.72rem', color:'var(--text-dim)'}}>
                          {day.approved
                            ? (day.reason ? day.reason : 'Approved, no reason given')
                            : 'No entry'}
                        </div>
                      </div>
                      {day.approved ? (
                        <button onClick={() => undoDay(day)} disabled={busyDay===day.date}
                          style={{padding:'6px 10px', borderRadius:'8px', cursor:'pointer', fontSize:'0.72rem',
                            border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'var(--text-dim)'}}>
                          Undo
                        </button>
                      ) : (
                        <button onClick={() => approveDay(day)} disabled={busyDay===day.date}
                          style={{padding:'6px 12px', borderRadius:'8px', cursor:'pointer', fontSize:'0.75rem',
                            fontWeight:700, border:'1px solid rgba(52,168,83,0.45)',
                            background:'rgba(52,168,83,0.12)', color:'#34A853'}}>
                          {busyDay===day.date ? '...' : 'OK'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
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
