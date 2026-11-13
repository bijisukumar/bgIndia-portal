// ============================================================
//  IrrigationLog.jsx — Zone-based irrigation logging
//  Replaces the Google Form approach
//  Route: /pollachi/irrigation
// ============================================================
import { useState, useEffect } from 'react'
import { useBack } from '../../utils/navTrail'
import { api } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import { parseLocalDate, localTodayStr } from '../../utils/dates'

// 'pradosh' -> 'Pradosh' (the actor name is stored in lower case)
const who = a => (a ? a.charAt(0).toUpperCase() + a.slice(1) : '')

function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return d }
}

export default function IrrigationLog({ estate = 'pollachi' }) {
  const goBack = useBack()
  const [zones, setZones]       = useState([])
  const [selected, setSelected] = useState({}) // zone_id -> checked
  const [date, setDate]         = useState(() => localTodayStr())   // read when the screen opens, not when the app was first loaded
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
  const { user } = useAuth()
  // The owner may wave a gap through with OK. The estate manager may not: he updates the day, or says why.
  const isOwner = user?.role === 'owner' || user?.role === 'master_owner'
  const [updatingDay, setUpdatingDay] = useState(null)   // the day with no entry that Update now opened the form for
  const [explainDay, setExplainDay]   = useState(null)   // the day whose "not watered, because..." box is open
  const [explainCode, setExplainCode] = useState('')     // which of the fixed reasons, so a season of gaps can be added up
  const [explainNote, setExplainNote] = useState('')     // the detail a code cannot carry; the whole answer for 'other'

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  useEffect(() => { loadZones() }, [estate])
  useEffect(() => { if (tab === 'history') loadHistory() }, [tab])
  // Loaded on arrival, not only when the tab is opened, so the count on the tab is there the moment he walks in.
  useEffect(() => { loadMissing() }, [estate, missDays])
  useEffect(() => { if (tab === 'missing') loadMissing() }, [tab])

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

  // Update now: the same form the log tab always had, opened on the day that has no entry. The date stays on
  // that day until he saves or cancels, so the entry cannot land on some other date.
  function startUpdate(day) {
    setUpdatingDay(day.date)
    setDate(day.date)
    setSelected({}); setRaining(false); setNotes(''); setDuration('')
    setExplainDay(null)
    setTab('log')
    try { window.scrollTo(0, 0) } catch { /* nothing to scroll */ }
  }

  function cancelUpdate() {
    setUpdatingDay(null)
    setDate(localTodayStr())
    setSelected({}); setRaining(false); setNotes(''); setDuration('')
    setTab('missing')
  }

  // Nothing was watered that day. Not a bare OK: the estate manager picks the cause from the fixed
  // list, and it is stored under his name against that date for the owner to read and to count.
  const explainReady = !!explainCode && (explainCode !== 'other' || explainNote.trim().length >= 3)

  async function saveExplanation(day) {
    if (!explainReady) {
      showToast(explainCode ? 'Say in a few words what happened' : 'Pick why nothing was watered', 'error')
      return
    }
    setBusyDay(day.date)
    try {
      await api.approveIrrigationMissedDay({
        estate, date: day.date, reasonCode: explainCode, reason: explainNote.trim(),
      })
      setExplainDay(null); setExplainCode(''); setExplainNote('')
      await loadMissing()
      showToast('Saved: ' + fmtDate(day.date))
    } catch(e) { showToast(e?.message || 'Could not save', 'error') }
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
      if (updatingDay) {
        // Back to the list, which reloads: the day he has just filled in is gone and the next one is the next job.
        showToast('✅ Saved for ' + fmtDate(updatingDay))
        setUpdatingDay(null)
        setDate(localTodayStr())
        setTab('missing')
      }
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
            {updatingDay && (
              <div style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', marginBottom:'12px',
                borderRadius:'10px', background:'rgba(200,144,58,0.12)', border:'1px solid rgba(200,144,58,0.45)'}}>
                <div style={{flex:1, minWidth:0, fontSize:'0.82rem', color:'#C8903A', fontWeight:600}}>
                  Updating {fmtDate(updatingDay)}, a day with no entry. Tick the zones that were watered.
                </div>
                <button onClick={cancelUpdate}
                  style={{padding:'6px 12px', borderRadius:'8px', cursor:'pointer', fontSize:'0.74rem', flexShrink:0,
                    border:'1px solid rgba(255,255,255,0.18)', background:'transparent', color:'var(--text-dim)'}}>
                  Cancel
                </button>
              </div>
            )}

            {!updatingDay && !isOwner && missing?.outstanding > 0 && (
              <div onClick={() => setTab('missing')}
                style={{padding:'10px 14px', marginBottom:'12px', borderRadius:'10px', cursor:'pointer',
                  fontSize:'0.82rem', fontWeight:600, color:'#EF4444',
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.35)'}}>
                ⚠️ {missing.outstanding} day{missing.outstanding === 1 ? '' : 's'} in the last {missing.days} with no entry. Update them now →
              </div>
            )}

            {/* Date + duration */}
            <div className="card-section-label">IRRIGATION DATE</div>
            <div className="card" style={{marginBottom:'12px'}}>
              <div className="grid-2">
                <div>
                  <label style={{display:'block', fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px'}}>DATE</label>
                  <input type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={!!updatingDay}
                    style={{...INP, opacity: updatingDay ? 0.7 : 1}}/>
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
                    {missing.outstanding} still to {isOwner ? 'look at' : 'update'}
                  </strong>
                  {missing.missing.length - missing.outstanding > 0 &&
                    ', ' + (missing.missing.length - missing.outstanding) + (isOwner ? ' approved' : ' explained')}.
                </p>

                {!isOwner && missing.outstanding > 0 && (
                  <div style={{background:'rgba(200,144,58,0.08)', border:'1px solid rgba(200,144,58,0.3)', borderRadius:'10px',
                    padding:'10px 12px', marginBottom:'12px', fontSize:'0.78rem', color:'var(--text-dim)'}}>
                    Tap <strong style={{color:'#C8903A'}}>Update now</strong> and record what was watered that day.
                    If nothing was watered, tap <strong>Not watered</strong> and say why.
                  </div>
                )}

                {/* What the codes are for. Not a tally of taps - a tally of causes, which is the
                    only thing twenty-eight explained gaps can usefully become. */}
                {missing.byCode?.length > 0 && (
                  <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'12px'}}>
                    {missing.byCode.map(c => (
                      <span key={c.code}
                        style={{padding:'4px 10px', borderRadius:'14px', fontSize:'0.72rem',
                          background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                          color:'var(--text-dim)'}}>
                        {c.label} <strong style={{color:'var(--text)'}}>{c.days}</strong>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                  {missing.missing.map(day => (
                    <div key={day.date}>
                    <div
                      style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px',
                        borderRadius:'10px',
                        background: day.approved ? 'rgba(52,168,83,0.06)' : 'rgba(239,68,68,0.06)',
                        border:'1px solid ' + (day.approved ? 'rgba(52,168,83,0.25)' : 'rgba(239,68,68,0.25)')}}>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontWeight:600, fontSize:'0.88rem'}}>{fmtDate(day.date)}</div>
                        <div style={{fontSize:'0.72rem', color:'var(--text-dim)'}}>
                          {day.approved
                            ? [day.reasonLabel, day.reason].filter(Boolean).join(' - ')
                              || 'Approved, no reason given'
                            : 'No entry'}
                          {day.approved && day.approvedBy ? ' - ' + who(day.approvedBy) : ''}
                        </div>
                      </div>
                      {day.approved ? (
                        (isOwner || day.approvedBy === user?.actor) && (
                          <button onClick={() => undoDay(day)} disabled={busyDay===day.date}
                            style={{padding:'6px 10px', borderRadius:'8px', cursor:'pointer', fontSize:'0.72rem',
                              border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'var(--text-dim)'}}>
                            Undo
                          </button>
                        )
                      ) : isOwner ? (
                        <button onClick={() => approveDay(day)} disabled={busyDay===day.date}
                          style={{padding:'6px 12px', borderRadius:'8px', cursor:'pointer', fontSize:'0.75rem',
                            fontWeight:700, border:'1px solid rgba(52,168,83,0.45)',
                            background:'rgba(52,168,83,0.12)', color:'#34A853'}}>
                          {busyDay===day.date ? '...' : 'OK'}
                        </button>
                      ) : (
                        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', flexShrink:0}}>
                          <button onClick={() => startUpdate(day)} disabled={busyDay===day.date}
                            style={{padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'0.8rem',
                              fontWeight:700, border:'1px solid rgba(200,144,58,0.6)',
                              background:'rgba(200,144,58,0.18)', color:'#C8903A'}}>
                            Update now
                          </button>
                          <button onClick={() => { setExplainDay(explainDay === day.date ? null : day.date); setExplainCode(''); setExplainNote('') }}
                            style={{padding:'2px 4px', cursor:'pointer', fontSize:'0.7rem', background:'transparent',
                              border:'none', color:'var(--text-dim)', textDecoration:'underline'}}>
                            Not watered
                          </button>
                        </div>
                      )}
                    </div>
                    {explainDay === day.date && !day.approved && !isOwner && (
                      <div style={{margin:'4px 0 2px', padding:'10px 12px', borderRadius:'10px',
                        background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)'}}>
                        <div style={{fontSize:'0.74rem', color:'var(--text-dim)', marginBottom:'8px'}}>
                          Why was nothing watered on {fmtDate(day.date)}? If it rained, use Update now and tick Raining.
                        </div>
                        {/* The list comes from the Worker, which is also what validates it. Two copies of
                            these words would disagree the first time either was touched. */}
                        <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px'}}>
                          {(missing.reasonCodes || []).map(r => (
                            <button key={r.code} onClick={() => setExplainCode(r.code)}
                              style={{padding:'5px 10px', borderRadius:'14px', cursor:'pointer', fontSize:'0.72rem',
                                border:'1px solid ' + (explainCode === r.code ? 'rgba(200,144,58,0.5)' : 'rgba(255,255,255,0.12)'),
                                background: explainCode === r.code ? 'rgba(200,144,58,0.15)' : 'transparent',
                                color: explainCode === r.code ? '#C8903A' : 'var(--text-dim)'}}>
                              {r.label}
                            </button>
                          ))}
                        </div>
                        <input value={explainNote} onChange={e => setExplainNote(e.target.value)} maxLength={200}
                          placeholder={explainCode === 'other' ? 'What happened that day (needed)' : 'Anything to add (optional)'}
                          style={INP}/>
                        <button onClick={() => saveExplanation(day)}
                          disabled={busyDay === day.date || !explainReady}
                          style={{width:'100%', marginTop:'8px', padding:'9px', borderRadius:'8px', fontSize:'0.8rem', fontWeight:700,
                            cursor: explainReady ? 'pointer' : 'default',
                            opacity: explainReady ? 1 : 0.5,
                            border:'1px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.06)', color:'var(--text)'}}>
                          {busyDay === day.date ? 'Saving...' : 'Save reason'}
                        </button>
                      </div>
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
                  {h.late_days > 0 && (
                    <div style={{fontSize:'0.68rem', color:'#F59E0B', marginTop:'2px'}}>
                      Entered {h.late_days} day{h.late_days === 1 ? '' : 's'} late
                    </div>
                  )}
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
