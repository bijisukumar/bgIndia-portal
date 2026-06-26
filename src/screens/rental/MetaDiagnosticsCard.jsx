// ============================================================
//  MetaDiagnosticsCard.jsx — Module D: Cloud Sync & Diagnostics
// ============================================================
const F = {
  label: {display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'12px'},
  input: {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'},
}

export default function MetaDiagnosticsCard({ form, setField, propName, readOnly }) {
  return (
    <div className="card">
      <div className="card-section-label">Cloud Sync & Diagnostics</div>

      <label style={F.label}>GOOGLE DRIVE FOLDER PATH</label>
      <input value={form.driveFolderUrl} disabled={readOnly}
        onChange={e=>setField('driveFolderUrl', e.target.value)}
        placeholder="RentalManagement/PropertyName/TenantName"
        style={{...F.input, fontFamily:'monospace', fontSize:'0.8rem', opacity: readOnly ? 0.6 : 1}}/>
      <div style={{fontSize:'0.68rem', color:'#5C7080', marginTop:'4px'}}>
        Format: RentalManagement / {propName || 'Property'} / TenantName / [Move-in, Contracts, Move-out, Renewals] — auto-filled when you enter a tenant name, but editable if you need to point it elsewhere.
      </div>

      <label style={F.label}>NOTES</label>
      <textarea value={form.notes} disabled={readOnly} onChange={e=>setField('notes',e.target.value)}
        placeholder="Parking slot, special terms, emergency contact…" rows={3}
        style={{...F.input, resize:'vertical', opacity: readOnly ? 0.6 : 1}}/>
    </div>
  )
}
