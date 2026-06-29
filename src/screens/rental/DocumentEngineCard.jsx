// ============================================================
//  DocumentEngineCard.jsx — Module B: Document Generation Engine
//
//  [ Generate Lease Template ] reuses the existing, tested
//  downloadLeaseDeed()/downloadLeaseDeedPdf() for India. For USA
//  there is no equivalent config (no lessor/bank/late-fee terms have
//  ever been provided for a US tenancy) — rather than generate a
//  document with invented US legal terms, the button stays visible
//  but explains the gap and defers to the owner.
//
//  [ Generate Move-In Document ] / [ Generate Move-Out Document ]
//  work for both countries today — they're inspection checklists, not
//  legal documents, so there's nothing India- or US-specific in them.
//
//  Format: defaults to PDF (signature included) per explicit decision
//  2026-06-28; a small checkbox per button switches to the original
//  .docx generator for cases where the owner needs to hand-edit text
//  after generating. See formatChoice.js for the centralized wiring.
// ============================================================
import { useState } from 'react'
import { generateMoveReportAny, generateLeaseDeedAny } from '../../utils/formatChoice'
import FormatToggle from './FormatToggle'

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
  const [useDocxLease, setUseDocxLease] = useState(false)
  const [useDocxMoveIn, setUseDocxMoveIn] = useState(false)
  const [useDocxMoveOut, setUseDocxMoveOut] = useState(false)

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
        <>
          <GenButton
            label={`📄 Generate Lease Template (${useDocxLease ? '.docx' : '.pdf'})`}
            busyLabel="Generating…"
            busy={busy === 'lease'}
            disabled={readOnly || !saved}
            color="#185FA5"
            onClick={() => run('lease', () => generateLeaseDeedAny(!useDocxLease, agreement, property), `📄 Lease deed generated for ${agreement?.tenant_name}`)}
          />
          <FormatToggle useDocx={useDocxLease} onChange={setUseDocxLease} idSuffix="lease" />
        </>
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
        label={`🔑 Generate Move-In Document (${useDocxMoveIn ? '.docx' : '.pdf'})`}
        busyLabel="Generating…"
        busy={busy === 'movein'}
        disabled={readOnly || !saved}
        color="#34A853"
        onClick={() => run('movein', () => generateMoveReportAny(!useDocxMoveIn, 'move-in', agreement, property), `🔑 Move-in report generated for ${agreement?.tenant_name}`)}
      />
      <FormatToggle useDocx={useDocxMoveIn} onChange={setUseDocxMoveIn} idSuffix="movein" />

      <GenButton
        label={`📦 Generate Move-Out Document (${useDocxMoveOut ? '.docx' : '.pdf'})`}
        busyLabel="Generating…"
        busy={busy === 'moveout'}
        disabled={readOnly || !saved}
        color="#5C7080"
        onClick={() => run('moveout', () => generateMoveReportAny(!useDocxMoveOut, 'move-out', agreement, property), `📦 Move-out report generated for ${agreement?.tenant_name}`)}
      />
      <FormatToggle useDocx={useDocxMoveOut} onChange={setUseDocxMoveOut} idSuffix="moveout" />

      {!saved && (
        <div style={{fontSize:'0.68rem', color:'#5C7080', marginTop:'8px', textAlign:'center'}}>
          Save the agreement first to enable document generation.
        </div>
      )}
    </div>
  )
}
