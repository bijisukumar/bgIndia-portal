// ============================================================
//  PropertyDocs.jsx — Document registry for a property
//  Used as an embedded section inside PropertyDetails
// ============================================================
import { useState, useEffect } from 'react'
import { api } from '../../api'
import { parseLocalDate } from '../../utils/dates'

const CATEGORIES = [
  'Purchase documents',
  'Title & ownership',
  'Government / Registration',
  'Property tax receipts',
  'Loan / Mortgage',
  'Insurance',
  'HOA',
  'Renovation / Permits',
  'Utility agreements',
  'Legal',
  'Other',
]

const CAT_ICON = {
  'Purchase documents':      '🏠',
  'Title & ownership':       '📜',
  'Government / Registration':'🏛️',
  'Property tax receipts':   '🧾',
  'Loan / Mortgage':         '🏦',
  'Insurance':               '🛡️',
  'HOA':                     '🏘️',
  'Renovation / Permits':    '🔨',
  'Utility agreements':      '⚡',
  'Legal':                   '⚖️',
  'Other':                   '📎',
}

const EMPTY_FORM = {
  category: 'Purchase documents',
  docName: '',
  driveUrl: '',
  driveFolderUrl: '',
  fileType: '',
  docDate: '',
  notes: '',
}

function fmtDate(d) {
  if (!d) return ''
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return d }
}

export default function PropertyDocs({ propId, propName }) {
  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({...EMPTY_FORM})
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [filterCat, setFilterCat] = useState('All')

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }
  const sf = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [propId])

  async function load() {
    setLoading(true)
    try {
      const d = await api.getPropertyDocs(propId)
      setDocs(Array.isArray(d?.data) ? d.data : [])
    } catch(e) { setDocs([]) }
    finally { setLoading(false) }
  }

  async function handleSave() {
    if (!form.docName.trim()) { showToast('Document name is required', 'error'); return }
    setSaving(true)
    try {
      await api.savePropertyDoc({
        docId: editId || null,
        propId,
        category:       form.category,
        docName:        form.docName.trim(),
        driveUrl:       form.driveUrl.trim() || null,
        driveFolderUrl: form.driveFolderUrl.trim() || null,
        fileType:       form.fileType.trim() || null,
        docDate:        form.docDate || null,
        notes:          form.notes.trim() || null,
      })
      showToast(editId ? '✅ Updated' : '✅ Document added')
      setShowForm(false); setEditId(null); setForm({...EMPTY_FORM})
      load()
    } catch(e) { showToast('Save failed', 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(docId, docName) {
    if (!confirm(`Delete "${docName}"?`)) return
    try {
      await api.deletePropertyDoc({ docId })
      setDocs(d => d.filter(x => x.doc_id !== docId))
      showToast('Deleted')
    } catch(e) { showToast('Delete failed', 'error') }
  }

  function openEdit(doc) {
    setEditId(doc.doc_id)
    setForm({
      category:       doc.category,
      docName:        doc.doc_name,
      driveUrl:       doc.drive_url || '',
      driveFolderUrl: doc.drive_folder_url || '',
      fileType:       doc.file_type || '',
      docDate:        doc.doc_date || '',
      notes:          doc.notes || '',
    })
    setShowForm(true)
  }

  // Group docs by category for display
  const usedCats = [...new Set(docs.map(d => d.category))]
  const filtered = filterCat === 'All' ? docs : docs.filter(d => d.category === filterCat)
  const grouped  = {}
  filtered.forEach(d => {
    if (!grouped[d.category]) grouped[d.category] = []
    grouped[d.category].push(d)
  })

  const INP = { width:'100%', padding:'9px 12px', borderRadius:'8px', boxSizing:'border-box', background:'var(--dark-input)', border:'1px solid var(--border-dim)', color:'var(--text)', fontSize:'0.9rem' }
  const LBL = { display:'block', fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px' }

  return (
    <div style={{ marginTop: '8px' }}>

      {/* Section header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <div className="card-section-label" style={{ marginBottom:0, color:'#8B5CF6' }}>
          📂 DOCUMENTS {docs.length > 0 && `(${docs.length})`}
        </div>
        <button onClick={() => { setEditId(null); setForm({...EMPTY_FORM}); setShowForm(s=>!s) }}
          style={{ padding:'6px 14px', borderRadius:'8px', border:'none', background:'#8B5CF6', color:'#fff', fontWeight:'700', fontSize:'0.78rem', cursor:'pointer' }}>
          {showForm && !editId ? '✕ Cancel' : '+ Add doc'}
        </button>
      </div>

      {/* Drive folder quick link */}
      <div style={{ background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', fontSize:'0.78rem' }}>
        <span style={{ color:'#9AA5B4' }}>Google Drive root: </span>
        <span style={{ color:'#8B5CF6', fontFamily:'monospace' }}>
          RentalManagement / {propName} / Documents
        </span>
        <div style={{ fontSize:'0.68rem', color:'#5C7080', marginTop:'4px' }}>
          Suggested subfolders: Purchase docs · Title · Govt registration · Tax receipts · Loan · Insurance · Permits
        </div>
      </div>

      {/* Category filter pills */}
      {usedCats.length > 1 && (
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
          {['All', ...usedCats].map(c => (
            <button key={c} onClick={() => setFilterCat(c)} style={{
              padding:'4px 10px', borderRadius:'16px', cursor:'pointer', fontSize:'0.7rem', fontWeight:'600',
              border:`1px solid ${filterCat===c?'#8B5CF6':'rgba(255,255,255,0.1)'}`,
              background:filterCat===c?'rgba(139,92,246,0.15)':'transparent',
              color:filterCat===c?'#8B5CF6':'#5C7080',
            }}>
              {c==='All' ? `All (${docs.length})` : `${CAT_ICON[c]||'📎'} ${c}`}
            </button>
          ))}
        </div>
      )}

      {/* Add / edit form */}
      {showForm && (
        <div style={{ background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'12px', padding:'14px', marginBottom:'12px' }}>
          <div style={{ fontWeight:'700', color:'#8B5CF6', fontSize:'0.82rem', marginBottom:'12px' }}>
            {editId ? '✏️ Edit document' : '+ New document'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {/* Category */}
            <div>
              <label style={LBL}>CATEGORY</label>
              <select value={form.category} onChange={e=>sf('category',e.target.value)} style={INP}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            {/* Doc date */}
            <div>
              <label style={LBL}>DOCUMENT DATE</label>
              <input type="date" value={form.docDate} onChange={e=>sf('docDate',e.target.value)} style={INP}/>
            </div>
            {/* Name — full width */}
            <div style={{ gridColumn:'span 2' }}>
              <label style={LBL}>DOCUMENT NAME *</label>
              <input value={form.docName} onChange={e=>sf('docName',e.target.value)}
                placeholder="e.g. Sale deed, EC 2019-2024, Property tax FY2023 receipt…"
                style={INP}/>
            </div>
            {/* Drive file link */}
            <div style={{ gridColumn:'span 2' }}>
              <label style={LBL}>GOOGLE DRIVE FILE LINK</label>
              <input value={form.driveUrl} onChange={e=>sf('driveUrl',e.target.value)}
                placeholder="https://drive.google.com/file/d/…"
                style={{ ...INP, fontFamily:'monospace', fontSize:'0.8rem', color:'#85B7EB' }}/>
            </div>
            {/* Drive folder link */}
            <div style={{ gridColumn:'span 2' }}>
              <label style={LBL}>GOOGLE DRIVE FOLDER LINK (optional)</label>
              <input value={form.driveFolderUrl} onChange={e=>sf('driveFolderUrl',e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                style={{ ...INP, fontFamily:'monospace', fontSize:'0.8rem', color:'#85B7EB' }}/>
            </div>
            {/* File type */}
            <div>
              <label style={LBL}>FILE TYPE</label>
              <input value={form.fileType} onChange={e=>sf('fileType',e.target.value)}
                placeholder="PDF, JPG, DOCX…" style={INP}/>
            </div>
            {/* Notes */}
            <div>
              <label style={LBL}>NOTES</label>
              <input value={form.notes} onChange={e=>sf('notes',e.target.value)}
                placeholder="Page count, issuing authority, remarks…" style={INP}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', marginTop:'12px' }}>
            <button onClick={()=>{setShowForm(false);setEditId(null)}}
              style={{ flex:1, padding:'9px', borderRadius:'9px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', cursor:'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !form.docName.trim()}
              style={{ flex:2, padding:'9px', borderRadius:'9px', border:'none', background:'#8B5CF6', color:'#fff', fontWeight:'700', cursor:'pointer', opacity:saving||!form.docName.trim()?0.6:1 }}>
              {saving ? 'Saving…' : editId ? 'Update' : 'Add document'}
            </button>
          </div>
        </div>
      )}

      {/* Document list grouped by category */}
      {loading && <div style={{ textAlign:'center', color:'#5C7080', padding:'20px', fontSize:'0.82rem' }}>Loading documents…</div>}

      {!loading && docs.length === 0 && !showForm && (
        <div style={{ textAlign:'center', padding:'28px', color:'#5C7080', fontSize:'0.85rem', border:'1px dashed rgba(139,92,246,0.2)', borderRadius:'12px' }}>
          No documents yet for {propName}.<br/>
          <span style={{ fontSize:'0.75rem' }}>Tap "+ Add doc" to start your document registry.</span>
        </div>
      )}

      {Object.entries(grouped).map(([cat, catDocs]) => (
        <div key={cat} style={{ marginBottom:'12px' }}>
          <div style={{ fontSize:'0.68rem', color:'#8B5CF6', letterSpacing:'1.5px', fontWeight:'700', marginBottom:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
            {CAT_ICON[cat]||'📎'} {cat.toUpperCase()}
            <span style={{ fontSize:'0.65rem', color:'#5C7080', fontWeight:'400' }}>({catDocs.length})</span>
          </div>
          {catDocs.map(doc => (
            <div key={doc.doc_id} style={{
              display:'flex', alignItems:'flex-start', gap:'10px',
              padding:'10px 12px', marginBottom:'6px', borderRadius:'10px',
              background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)',
            }}>
              {/* Icon */}
              <div style={{ fontSize:'1.2rem', flexShrink:0, marginTop:'1px' }}>
                {doc.file_type?.toUpperCase()==='PDF' ? '📄'
                  : doc.file_type?.toUpperCase()==='JPG'||doc.file_type?.toUpperCase()==='PNG' ? '🖼️'
                  : CAT_ICON[doc.category]||'📎'}
              </div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  <span style={{ fontWeight:'600', fontSize:'0.88rem', color:'#EDF2F7' }}>{doc.doc_name}</span>
                  {doc.file_type && (
                    <span style={{ fontSize:'0.62rem', color:'#5C7080', background:'rgba(255,255,255,0.06)', padding:'1px 6px', borderRadius:'6px' }}>
                      {doc.file_type.toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:'0.72rem', color:'#5C7080', marginTop:'3px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                  {doc.doc_date && <span>📅 {fmtDate(doc.doc_date)}</span>}
                  {doc.notes && <span>· {doc.notes}</span>}
                </div>
                {/* Links */}
                <div style={{ display:'flex', gap:'8px', marginTop:'6px', flexWrap:'wrap' }}>
                  {doc.drive_url && (
                    <a href={doc.drive_url} target="_blank" rel="noreferrer"
                      style={{ fontSize:'0.72rem', color:'#85B7EB', textDecoration:'none', padding:'3px 8px', borderRadius:'6px', border:'1px solid rgba(133,183,235,0.25)', background:'rgba(133,183,235,0.08)', display:'flex', alignItems:'center', gap:'4px' }}>
                      🔗 Open file
                    </a>
                  )}
                  {doc.drive_folder_url && (
                    <a href={doc.drive_folder_url} target="_blank" rel="noreferrer"
                      style={{ fontSize:'0.72rem', color:'#8B5CF6', textDecoration:'none', padding:'3px 8px', borderRadius:'6px', border:'1px solid rgba(139,92,246,0.25)', background:'rgba(139,92,246,0.08)', display:'flex', alignItems:'center', gap:'4px' }}>
                      📁 Open folder
                    </a>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => openEdit(doc)}
                  style={{ padding:'4px 10px', borderRadius:'7px', border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#9AA5B4', fontSize:'0.72rem', cursor:'pointer' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(doc.doc_id, doc.doc_name)}
                  style={{ padding:'4px 10px', borderRadius:'7px', border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#EF4444', fontSize:'0.72rem', cursor:'pointer' }}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
