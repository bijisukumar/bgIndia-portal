// ============================================================
//  RoomInspectionCard.jsx — room-by-room condition capture at
//  move-in/move-out, the data-backed counterpart to the printable
//  checklist in Document Generation (generateMoveReport.js). A
//  Damaged room can be pushed straight into the Claims Ledger
//  (rev360_lease_losses) with one click, carrying its notes/photo
//  link along as the claim's description/evidence, rather than
//  re-typing the same thing twice.
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { DEFAULT_ROOMS } from '../../utils/docGenHelpers'

const CLAIM_CATEGORIES = ['Damage','Cleaning','Other']

export default function RoomInspectionCard({ propId, agreement, property, saved, readOnly, showToast }) {
  const navigate = useNavigate()
  const currency = agreement?.currency || 'INR'
  const [eventType, setEventType] = useState('move_in')
  const [rows, setRows] = useState({})          // room name -> saved row (or undefined if never touched)
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({})      // room name -> { notes, photoUrl } while being edited
  const [savingRoom, setSavingRoom] = useState(null)
  const [claimDraft, setClaimDraft] = useState(null) // { room, category, amount } while adding to Claims Ledger
  const [addingClaim, setAddingClaim] = useState(false)
  const [customRoomName, setCustomRoomName] = useState('')

  useEffect(() => { if (saved) load() }, [propId, saved, eventType])

  async function load() {
    setLoading(true)
    try {
      const data = await api.getRoomInspections(propId, eventType)
      const map = {}
      ;(Array.isArray(data) ? data : []).forEach(row => { map[row.room] = row })
      setRows(map)
      setDrafts({})
    } catch (e) { setRows({}) }
    finally { setLoading(false) }
  }

  const customRooms = Object.keys(rows).filter(r => !DEFAULT_ROOMS.includes(r))
  const allRooms = [...DEFAULT_ROOMS, ...customRooms]
  const damagedCount = allRooms.filter(r => rows[r]?.condition === 'Damaged').length
  const linkedCount = allRooms.filter(r => rows[r]?.loss_id).length

  async function handleSetCondition(room, condition) {
    const existing = rows[room]
    try {
      const saved = await api.saveRoomInspection({
        propId, eventType, room, condition,
        notes: existing?.notes || '', photoUrl: existing?.photo_url || '',
        tenantSnapshot: agreement?.tenant_name || '',
      })
      setRows(r => ({ ...r, [room]: saved }))
    } catch (e) { showToast('Could not save: ' + e.message, 'error') }
  }

  function getDraft(room) {
    return drafts[room] || { notes: rows[room]?.notes || '', photoUrl: rows[room]?.photo_url || '' }
  }
  function setDraftField(room, field, value) {
    setDrafts(d => ({ ...d, [room]: { ...getDraft(room), [field]: value } }))
  }

  async function handleSaveDetails(room) {
    const draft = getDraft(room)
    setSavingRoom(room)
    try {
      const existing = rows[room]
      const saved = await api.saveRoomInspection({
        propId, eventType, room, condition: existing?.condition || 'Damaged',
        notes: draft.notes, photoUrl: draft.photoUrl,
        tenantSnapshot: agreement?.tenant_name || '',
      })
      setRows(r => ({ ...r, [room]: saved }))
      showToast('✅ Saved')
    } catch (e) { showToast('Save failed: ' + e.message, 'error') }
    finally { setSavingRoom(null) }
  }

  function openClaimDraft(room) {
    const draft = getDraft(room)
    setClaimDraft({ room, category: 'Damage', amount: '', description: draft.notes ? `${room}: ${draft.notes}` : room })
  }

  async function handleAddToClaims() {
    if (!claimDraft) return
    if (!claimDraft.amount || isNaN(parseFloat(claimDraft.amount))) { showToast('Amount is required', 'error'); return }
    setAddingClaim(true)
    try {
      const { room, category, amount, description } = claimDraft
      const draft = getDraft(room)
      const snap = agreement ? `${agreement.tenant_name} | ${agreement.lease_start} → ${agreement.lease_end}` : ''
      const result = await api.saveLeaseLoss({
        propId, leaseSnapshot: snap, itemCategory: category,
        description: description.trim() || room, amount: parseFloat(amount), currency,
        evidenceDriveUrl: draft.photoUrl || null, status: 'Estimated',
      })
      const saved = await api.saveRoomInspection({
        propId, eventType, room, condition: 'Damaged',
        notes: draft.notes, photoUrl: draft.photoUrl,
        tenantSnapshot: agreement?.tenant_name || '', lossId: result.lossId,
      })
      setRows(r => ({ ...r, [room]: saved }))
      setClaimDraft(null)
      showToast('✅ Added to Claims Ledger')
    } catch (e) { showToast('Could not add claim: ' + e.message, 'error') }
    finally { setAddingClaim(false) }
  }

  function handleAddCustomRoom() {
    const name = customRoomName.trim()
    if (!name) return
    if (allRooms.includes(name)) { showToast('That room is already listed', 'error'); return }
    setRows(r => ({ ...r, [name]: { room: name, condition: 'Good', notes: '', photo_url: '', loss_id: null } }))
    setCustomRoomName('')
  }

  async function handleRemoveCustomRoom(room) {
    const existing = rows[room]
    if (!existing?.inspection_id) {
      // Never actually saved (e.g. added via handleAddCustomRoom then
      // abandoned) -- just drop it from local state, nothing to delete.
      setRows(r => { const next = { ...r }; delete next[room]; return next })
      return
    }
    if (!confirm(`Remove "${room}" from the inspection?`)) return
    try {
      await api.deleteRoomInspection(existing.inspection_id)
      setRows(r => { const next = { ...r }; delete next[room]; return next })
    } catch (e) { showToast('Could not remove: ' + e.message, 'error') }
  }

  const F = {
    label:{display:'block',fontSize:'0.68rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'10px'},
    input:{width:'100%',padding:'8px 10px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.85rem'},
  }

  return (
    <div className="card" style={{marginTop:'12px'}}>
      <div className="card-section-label">🧱 Room Inspection</div>

      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        {[['move_in','🔑 Move-In'],['move_out','📦 Move-Out']].map(([val,label]) => (
          <button key={val} onClick={()=>setEventType(val)} style={{
            flex:1, padding:'8px 6px', borderRadius:'8px', cursor:'pointer', textAlign:'center',
            border: eventType===val ? '2px solid #E24B4A' : '1px solid var(--border-dim)',
            background: eventType===val ? 'rgba(226,75,74,0.1)' : 'var(--dark-card)',
            color:'var(--text)', fontSize:'0.82rem', fontWeight:'600',
          }}>{label}</button>
        ))}
      </div>

      {!saved ? (
        <div style={{fontSize:'0.78rem', color:'var(--text-dim)', padding:'8px 0'}}>Save the agreement first to start the inspection.</div>
      ) : (
        <>
          <div style={{fontSize:'0.78rem',color:'var(--text-dim)',marginBottom:'10px'}}>
            {damagedCount > 0
              ? <span><strong style={{color:'#E24B4A'}}>{damagedCount}</strong> of {allRooms.length} rooms damaged · <strong style={{color:'#34A853'}}>{linkedCount}</strong> linked to Claims Ledger</span>
              : <span>All {allRooms.length} rooms marked Good</span>}
          </div>

          {loading && <div style={{textAlign:'center',color:'var(--text-dim)',padding:'16px'}}>Loading…</div>}

          {!loading && allRooms.map(room => {
            const row = rows[room]
            const condition = row?.condition || 'Good'
            const isDamaged = condition === 'Damaged'
            const isCustom = !DEFAULT_ROOMS.includes(room)
            const draft = getDraft(room)
            return (
              <div key={room} style={{background:'var(--dark-input)',border:'1px solid var(--border-dim)',borderRadius:'10px',padding:'10px 12px',marginBottom:'8px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontWeight:'600',fontSize:'0.85rem',color:'var(--text)'}}>{room}</div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                    {!readOnly && (
                      <>
                        <button onClick={()=>handleSetCondition(room,'Good')} style={{
                          padding:'4px 10px',borderRadius:'12px',cursor:'pointer',fontSize:'0.68rem',fontWeight:'600',
                          border:`1px solid ${!isDamaged?'#34A853':'rgba(255,255,255,0.1)'}`,
                          background:!isDamaged?'rgba(52,168,83,0.15)':'transparent',
                          color:!isDamaged?'#34A853':'#5C7080',
                        }}>✓ Good</button>
                        <button onClick={()=>handleSetCondition(room,'Damaged')} style={{
                          padding:'4px 10px',borderRadius:'12px',cursor:'pointer',fontSize:'0.68rem',fontWeight:'600',
                          border:`1px solid ${isDamaged?'#E24B4A':'rgba(255,255,255,0.1)'}`,
                          background:isDamaged?'rgba(226,75,74,0.15)':'transparent',
                          color:isDamaged?'#E24B4A':'#5C7080',
                        }}>⚠ Damaged</button>
                      </>
                    )}
                    {isCustom && !readOnly && (
                      <button onClick={()=>handleRemoveCustomRoom(room)} style={{padding:'3px 6px',borderRadius:'6px',border:'none',background:'transparent',color:'#5C7080',fontSize:'0.72rem',cursor:'pointer'}}>✕</button>
                    )}
                  </div>
                </div>

                {isDamaged && (
                  <div style={{marginTop:'8px'}}>
                    <label style={F.label}>NOTES</label>
                    <input value={draft.notes} onChange={e=>setDraftField(room,'notes',e.target.value)}
                      placeholder="e.g. cracked tile near sink" style={F.input} disabled={readOnly}/>

                    <label style={F.label}>PHOTO (ONEDRIVE LINK)</label>
                    <input value={draft.photoUrl} onChange={e=>setDraftField(room,'photoUrl',e.target.value)}
                      placeholder="https://onedrive.live.com/…" style={F.input} disabled={readOnly}/>

                    {!readOnly && (
                      <div style={{display:'flex',gap:'8px',marginTop:'8px',flexWrap:'wrap'}}>
                        <button onClick={()=>handleSaveDetails(room)} disabled={savingRoom===room} style={{
                          padding:'5px 10px',borderRadius:'6px',border:'1px solid var(--border-dim)',background:'transparent',color:'var(--text-dim)',fontSize:'0.7rem',cursor:'pointer',
                        }}>{savingRoom===room?'Saving…':'Save details'}</button>
                        {row?.loss_id ? (
                          <button onClick={()=>navigate('/owner/rental/claims')} style={{
                            padding:'5px 10px',borderRadius:'6px',border:'1px solid rgba(52,168,83,0.4)',background:'rgba(52,168,83,0.1)',color:'#34A853',fontSize:'0.7rem',fontWeight:'600',cursor:'pointer',
                          }}>✓ Linked — view in Claims Ledger</button>
                        ) : (
                          <button onClick={()=>openClaimDraft(room)} style={{
                            padding:'5px 10px',borderRadius:'6px',border:'1px solid rgba(226,75,74,0.4)',background:'rgba(226,75,74,0.1)',color:'#E24B4A',fontSize:'0.7rem',fontWeight:'600',cursor:'pointer',
                          }}>+ Add to Claims Ledger</button>
                        )}
                      </div>
                    )}

                    {claimDraft?.room === room && (
                      <div style={{marginTop:'10px',padding:'10px',borderRadius:'8px',background:'rgba(226,75,74,0.06)',border:'1px solid rgba(226,75,74,0.2)'}}>
                        <div className="grid-2">
                          <div>
                            <label style={F.label}>CATEGORY</label>
                            <select value={claimDraft.category} onChange={e=>setClaimDraft(c=>({...c,category:e.target.value}))} style={F.input}>
                              {CLAIM_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={F.label}>AMOUNT ({currency==='USD'?'$':'₹'})</label>
                            <input type="number" min="0" value={claimDraft.amount} onChange={e=>setClaimDraft(c=>({...c,amount:e.target.value}))}
                              placeholder="0" style={{...F.input,color:'#E24B4A'}}/>
                          </div>
                        </div>
                        <label style={F.label}>DESCRIPTION</label>
                        <input value={claimDraft.description} onChange={e=>setClaimDraft(c=>({...c,description:e.target.value}))} style={F.input}/>
                        <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
                          <button onClick={()=>setClaimDraft(null)} style={{flex:1,padding:'8px',borderRadius:'8px',border:'1px solid var(--border-dim)',background:'transparent',color:'var(--text-dim)',fontSize:'0.78rem',cursor:'pointer'}}>Cancel</button>
                          <button onClick={handleAddToClaims} disabled={addingClaim} style={{flex:2,padding:'8px',borderRadius:'8px',border:'none',background:'#E24B4A',color:'#fff',fontWeight:'700',fontSize:'0.78rem',cursor:'pointer',opacity:addingClaim?0.6:1}}>
                            {addingClaim?'Saving…':'Add to Claims Ledger'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {!readOnly && (
            <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
              <input value={customRoomName} onChange={e=>setCustomRoomName(e.target.value)}
                placeholder="Add a room (e.g. Study, Garage)…" style={{...F.input,marginTop:0,flex:1}}/>
              <button onClick={handleAddCustomRoom} style={{padding:'0 14px',borderRadius:'8px',border:'none',background:'#E24B4A',color:'#fff',fontWeight:'700',fontSize:'0.78rem',cursor:'pointer'}}>+ Add</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
