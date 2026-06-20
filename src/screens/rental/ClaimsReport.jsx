// ============================================================
//  ClaimsReport.jsx — Court-ready small claims PDF generator
//  Route: /owner/rental/claims/report?prop=rental_1
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { parseLocalDate } from '../../utils/dates'

const CAT_ICON = { 'Rent':'💸','Damage':'🔨','Cleaning':'🧹','Legal':'⚖️','Other':'📌' }

function fmtDate(d) {
  if (!d) return '—'
  try { return parseLocalDate(d).toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'}) }
  catch { return d }
}
function fmtAmt(amount, currency='INR') {
  if (!amount && amount !== 0) return '—'
  if (currency === 'USD') return '$' + Math.abs(amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
  return '₹' + Math.abs(amount).toLocaleString('en-IN')
}

export default function ClaimsReport() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const propId = params.get('prop') || CONFIG.rentalProperties[0]?.id
  const [agreement, setAgreement] = useState(null)
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const reportRef = useRef(null)

  const prop = CONFIG.rentalProperties.find(p => p.id === propId)

  useEffect(() => {
    Promise.all([
      api.getRentalAgreements(),
      api.getLeaseLosses(propId),
    ]).then(([agrData, claimsData]) => {
      const agrs = Array.isArray(agrData) ? agrData : []
      setAgreement(agrs.find(a => a.prop_id === propId) || null)
      setClaims(Array.isArray(claimsData?.data) ? claimsData.data : [])
    }).catch(console.warn)
    .finally(()=>setLoading(false))
  }, [propId])

  function handlePrint() {
    window.print()
  }

  if (loading) return (
    <div className="screen"><div style={{textAlign:'center',padding:'40px',color:'var(--text-dim)'}}>Generating report…</div></div>
  )

  const currency = agreement?.currency || 'INR'
  const deposit = parseFloat(agreement?.deposit) || 0
  const totalClaimed = claims.reduce((s,c)=>s+(parseFloat(c.amount)||0),0)
  const totalRecovered = claims.filter(c=>c.status==='Recovered').reduce((s,c)=>s+(parseFloat(c.amount)||0),0)
  const netOwed = Math.max(0, totalClaimed - deposit - totalRecovered)
  const today = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})

  return (
    <div className="screen">
      {/* Screen controls — hidden on print */}
      <div className="topbar no-print">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Claims report</div>
          <div className="topbar-sub">SMALL CLAIMS · COURT-READY</div>
        </div>
        <button onClick={handlePrint}
          style={{padding:'8px 16px',borderRadius:'8px',border:'none',background:'#185FA5',color:'#fff',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer'}}>
          🖨️ Print / PDF
        </button>
      </div>

      <div className="screen-body no-print" style={{paddingBottom:'0'}}>
        <div style={{background:'rgba(24,95,165,0.08)',border:'1px solid rgba(24,95,165,0.2)',borderRadius:'10px',padding:'12px 14px',marginBottom:'16px',fontSize:'0.82rem',color:'#85B7EB'}}>
          Tap "Print / PDF" → select "Save as PDF" in your browser print dialog. For US Small Claims Court, print black & white at 100% scale.
        </div>
      </div>

      {/* ── PRINT-READY REPORT ── */}
      <div ref={reportRef} style={{
        fontFamily: 'Georgia, serif',
        color: '#000',
        background: '#fff',
        padding: '32px',
        maxWidth: '760px',
        margin: '0 auto',
        lineHeight: '1.5',
      }} className="print-report">

        {/* Header */}
        <div style={{textAlign:'center',borderBottom:'3px double #000',paddingBottom:'16px',marginBottom:'20px'}}>
          <div style={{fontSize:'13px',letterSpacing:'2px',textTransform:'uppercase',color:'#444',marginBottom:'6px'}}>
            {agreement?.country === 'US' ? 'Small Claims Court — Evidence & Loss Summary' : 'Rental Property — Loss & Claims Summary'}
          </div>
          <div style={{fontSize:'22px',fontWeight:'bold',marginBottom:'4px'}}>
            LANDLORD ITEMIZED LOSS STATEMENT
          </div>
          <div style={{fontSize:'11px',color:'#555'}}>
            Generated: {today} · Reference: {propId?.toUpperCase()}
          </div>
        </div>

        {/* Case info */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'20px',fontSize:'12px'}}>
          <div>
            <div style={{fontWeight:'bold',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',borderBottom:'1px solid #000',paddingBottom:'4px',marginBottom:'8px'}}>LANDLORD / CLAIMANT</div>
            <div style={{fontWeight:'bold'}}>{CONFIG.ownerEmail?.split('@')[0] || 'Property Owner'}</div>
            <div>{CONFIG.ownerEmail || ''}</div>
          </div>
          <div>
            <div style={{fontWeight:'bold',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',borderBottom:'1px solid #000',paddingBottom:'4px',marginBottom:'8px'}}>TENANT / RESPONDENT</div>
            <div style={{fontWeight:'bold'}}>{agreement?.tenant_name || '—'}</div>
            <div>{agreement?.tenant_email || ''}</div>
            <div>{agreement?.tenant_phone || ''}</div>
          </div>
          <div>
            <div style={{fontWeight:'bold',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',borderBottom:'1px solid #000',paddingBottom:'4px',marginBottom:'8px'}}>PROPERTY</div>
            <div style={{fontWeight:'bold'}}>{prop?.name || propId}</div>
            <div>{prop?.location || ''}</div>
          </div>
          <div>
            <div style={{fontWeight:'bold',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',borderBottom:'1px solid #000',paddingBottom:'4px',marginBottom:'8px'}}>LEASE PERIOD</div>
            <div>{fmtDate(agreement?.lease_start)} to</div>
            <div>{fmtDate(agreement?.lease_end)}</div>
            <div style={{marginTop:'4px'}}>Security deposit held: <strong>{fmtAmt(deposit, currency)}</strong></div>
          </div>
        </div>

        {/* Itemized table */}
        <div style={{fontWeight:'bold',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',borderBottom:'2px solid #000',paddingBottom:'4px',marginBottom:'0'}}>
          ITEMIZED LOSS STATEMENT
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px',marginBottom:'20px'}}>
          <thead>
            <tr style={{background:'#f0f0f0'}}>
              {['#','Category','Description','Evidence','Amount','Status'].map(h=>(
                <th key={h} style={{padding:'8px 6px',textAlign:h==='Amount'?'right':'left',borderBottom:'1px solid #000',borderTop:'1px solid #000',fontWeight:'bold',fontSize:'10px',letterSpacing:'0.5px',textTransform:'uppercase'}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {claims.map((item, i) => (
              <tr key={item.loss_id} style={{borderBottom:'1px solid #ddd',background:i%2===0?'#fff':'#fafafa'}}>
                <td style={{padding:'7px 6px',color:'#666',width:'24px'}}>{i+1}</td>
                <td style={{padding:'7px 6px',width:'80px'}}>{item.item_category}</td>
                <td style={{padding:'7px 6px'}}>{item.description}</td>
                <td style={{padding:'7px 6px',width:'140px',color:'#444',fontSize:'10px'}}>
                  {item.evidence_file_name && <div>{item.evidence_file_name}</div>}
                  {item.evidence_timestamp && <div>@ {item.evidence_timestamp}</div>}
                  {!item.evidence_file_name && !item.evidence_timestamp && '—'}
                </td>
                <td style={{padding:'7px 6px',textAlign:'right',fontWeight:'600',width:'90px'}}>
                  {fmtAmt(item.amount, item.currency||currency)}
                </td>
                <td style={{padding:'7px 6px',width:'90px',fontSize:'10px',color:item.status==='Unrecoverable'?'#c00':item.status==='Recovered'?'#070':'#555'}}>
                  {item.status}
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr><td colSpan={6} style={{padding:'16px',textAlign:'center',color:'#888'}}>No claims recorded</td></tr>
            )}
          </tbody>
        </table>

        {/* Settlement summary */}
        <div style={{border:'2px solid #000',padding:'16px',marginBottom:'24px',fontSize:'12px'}}>
          <div style={{fontWeight:'bold',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:'12px'}}>
            SETTLEMENT CALCULATION
          </div>
          {[
            {label:'Gross amount claimed', val:totalClaimed, bold:false},
            {label:'Security deposit applied', val:-deposit, bold:false, color:'#070'},
            {label:'Amount recovered', val:-totalRecovered, bold:false, color:'#070'},
          ].map(row=>(
            <div key={row.label} style={{display:'flex',justifyContent:'space-between',marginBottom:'6px',paddingBottom:'6px',borderBottom:'1px dashed #ccc'}}>
              <span>{row.label}</span>
              <span style={{fontWeight:row.bold?'bold':'normal',color:row.color||'#000'}}>{fmtAmt(Math.abs(row.val),currency)}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'14px',fontWeight:'bold',paddingTop:'8px',borderTop:'2px solid #000'}}>
            <span>NET AMOUNT CLAIMED IN COURT</span>
            <span style={{color:netOwed>0?'#c00':'#070'}}>{fmtAmt(netOwed, currency)}</span>
          </div>
        </div>

        {/* Declaration */}
        <div style={{fontSize:'11px',color:'#333',marginBottom:'32px',borderTop:'1px solid #ccc',paddingTop:'16px'}}>
          I, the undersigned landlord, hereby declare that the above itemized losses are true and accurate to the best of my knowledge. All evidence referenced herein is available for inspection upon request.
        </div>

        {/* Signature block */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'40px',fontSize:'11px'}}>
          <div>
            <div style={{borderTop:'1px solid #000',paddingTop:'8px',marginTop:'40px'}}>
              <div style={{fontWeight:'bold'}}>Landlord Signature</div>
              <div style={{color:'#555',marginTop:'4px'}}>{CONFIG.ownerEmail?.split('@')[0] || 'Property Owner'}</div>
            </div>
          </div>
          <div>
            <div style={{borderTop:'1px solid #000',paddingTop:'8px',marginTop:'40px'}}>
              <div style={{fontWeight:'bold'}}>Date</div>
              <div style={{color:'#555',marginTop:'4px'}}>{today}</div>
            </div>
          </div>
        </div>

        <div style={{textAlign:'center',fontSize:'9px',color:'#aaa',marginTop:'32px',borderTop:'1px solid #eee',paddingTop:'12px'}}>
          Generated by Rev360 Property Management · {CONFIG.ownerEmail}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-report { padding: 0 !important; max-width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}
