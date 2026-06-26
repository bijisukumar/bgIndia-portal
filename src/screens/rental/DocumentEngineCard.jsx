// ============================================================
//  DocumentEngineCard.jsx — Module B: Document Generation Engine
//
//  [ Generate Lease Template ] reuses the existing, tested
//  downloadLeaseDeed() for India. For USA there is no equivalent
//  config (no lessor/bank/late-fee terms have ever been provided for
//  a US tenancy) — rather than generate a document with invented US
//  legal terms, the button stays visible but explains the gap and
//  defers to the owner, matching the standing project rule against
//  shipping things that look done but produce wrong output.
//
//  [ Generate Move-In Document ] / [ Generate Move-Out Document ]
//  work for both countries today — they're inspection checklists, not
//  legal documents, so there's nothing India- or US-specific in them.
// ============================================================
import { useState } from 'react'
import { downloadLeaseDeed } from '../../utils/generateLeaseDeed'
import { downloadMoveReport } from '../../utils/generateMoveReport'

const BTN = {
  base: {
    width:'100%', marginTop:'10px', padding:'12px', borderRadius:'10px',
    fontWeight:'700', fontSize:'0.88rem', cursor:'pointer', border:'1px solid',
  },
}

function GenButton({ label, busyLabel, busy, disabled, onClick, color }) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      style={{
        ...BTN.base,
        borderColor: `${color}66`,
        background: `${color}14`,
        color,
        opacity: (busy || disabled) ? 0.5 : 1,
        cursor: (busy || disabled) ? 'default' : 'pointer',
      }}>
      {busy ? busyLabel : label}
    </button>
  )
}

export default function DocumentEngineCard({ agreement, property, country, saved, readOnly, showToast }) {
  const [busy, setBusy] = useState(null)

  async function run(key, fn, successMsg) {
    if (!saved) { showToast('Save the agreement first', 'error'); return }
    setBusy(key)
    try {
      await fn()
      showToast(successMsg)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card">
      <div className="card-section-label">Document Generation</div>

      {country === 'IN' ? (
        <GenButton
          label="📄 Generate Lease Template (.docx)"
          busyLabel="Generating…"
          busy={busy === 'lease'}
          disabled={readOnly || !saved}
          color="#185FA5"
          onClick={() => run('lease', () => downloadLeaseDeed(agreement, property), `📄 Lease deed generated for ${agreement?.tenant_name}`)}
        />
      ) : (
        <div style={{
          padding:'12px 14px', borderRadius:'10px', marginTop:'10px',
          background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)',
          color:'#F59E0B', fontSize:'0.78rem', lineHeight:1.5,
        }}>
          ⚠️ US lease terms haven't been set up yet — there's no equivalent of the India standard terms (late fees, jurisdiction, lessor bank details) on file for US tenancies, so this can't generate a real lease yet. Share the terms you want used and this can be wired up the same way the India template is.
        </div>
      )}

      <GenButton
        label="🔑 Generate Move-In Document (.docx)"
        busyLabel="Generating…"
        busy={busy === 'movein'}
        disabled={readOnly || !saved}
        color="#34A853"
        onClick={() => run('movein', () => downloadMoveReport('move-in', agreement, property), `🔑 Move-in report generated for ${agreement?.tenant_name}`)}
      />

      <GenButton
        label="📦 Generate Move-Out Document (.docx)"
        busyLabel="Generating…"
        busy={busy === 'moveout'}
        disabled={readOnly || !saved}
        color="#5C7080"
        onClick={() => run('moveout', () => downloadMoveReport('move-out', agreement, property), `📦 Move-out report generated for ${agreement?.tenant_name}`)}
      />

      {!saved && (
        <div style={{fontSize:'0.68rem', color:'#5C7080', marginTop:'8px', textAlign:'center'}}>
          Save the agreement first to enable document generation.
        </div>
      )}
    </div>
  )
}
