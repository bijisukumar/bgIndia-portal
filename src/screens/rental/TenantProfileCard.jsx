// ============================================================
//  TenantProfileCard.jsx — Module A: Core Profile
//  Tenant identity fields. The government-ID field is conditional on
//  country: PAN/Aadhaar for India, SSN/Driver's License for USA — this
//  is purely a label/placeholder swap on the existing tenantPan form
//  field, not a new column (no separate US identity field exists in
//  rental_props yet; adding one is a backend change beyond this card's
//  scope if/when a real US tenant needs it).
// ============================================================
const F = {
  label: {display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'12px'},
  input: {width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'},
}

export default function TenantProfileCard({ form, setField, onTenantNameChange, readOnly }) {
  const isUS = form.country === 'US'

  return (
    <div className="card">
      <div className="card-section-label">Core Profile</div>

      <label style={F.label}>TENANT NAME *</label>
      <input value={form.tenantName} disabled={readOnly}
        onChange={e=>onTenantNameChange(e.target.value)}
        placeholder="Full legal name" style={{...F.input, opacity: readOnly ? 0.6 : 1}}/>

      <div className="grid-2">
        <div>
          <label style={F.label}>EMAIL</label>
          <input type="email" value={form.tenantEmail} disabled={readOnly}
            onChange={e=>setField('tenantEmail',e.target.value)}
            placeholder="tenant@email.com" style={{...F.input, opacity: readOnly ? 0.6 : 1}}/>
        </div>
        <div>
          <label style={F.label}>PHONE</label>
          <input type="tel" value={form.tenantPhone} disabled={readOnly}
            onChange={e=>setField('tenantPhone',e.target.value)}
            placeholder={isUS ? '+1 …' : '+91 …'} style={{...F.input, opacity: readOnly ? 0.6 : 1}}/>
        </div>
      </div>

      <label style={F.label}>PERMANENT ADDRESS</label>
      <textarea value={form.tenantAddress} disabled={readOnly}
        onChange={e=>setField('tenantAddress',e.target.value)}
        placeholder="Full permanent address, as it should appear on the lease" rows={2}
        style={{...F.input, resize:'vertical', opacity: readOnly ? 0.6 : 1}}/>

      <label style={F.label}>{isUS ? "SSN / DRIVER'S LICENSE NO." : 'TENANT PAN / AADHAAR NUMBER'}</label>
      <input value={form.tenantPan} disabled={readOnly}
        onChange={e=>setField('tenantPan',e.target.value)}
        placeholder={isUS ? 'e.g. driver\u2019s license + issuing state' : 'e.g. AXRPS9969C or 1234 5678 9012'}
        style={{...F.input, opacity: readOnly ? 0.6 : 1}}/>
      <div style={{fontSize:'0.65rem',color:'#5C7080',marginTop:'4px'}}>
        {isUS
          ? 'US tenancies don\u2019t yet have a dedicated SSN/EIN field in the database \u2014 stored here for now.'
          : 'Required on the lease deed \u2014 used to identify the LESSEE in the legal document.'}
      </div>
    </div>
  )
}
