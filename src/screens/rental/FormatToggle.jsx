// ============================================================
//  FormatToggle.jsx
//  Small checkbox used next to every document-generation button:
//  "Use Word format (.docx) instead of PDF" — unchecked = PDF
//  (default, signature included), checked = the original .docx
//  generator, for cases where the owner needs to hand-edit specific
//  wording after generating. Per explicit decision, 2026-06-28.
// ============================================================
export default function FormatToggle({ useDocx, onChange, idSuffix }) {
  const id = `format-toggle-${idSuffix}`
  return (
    <label htmlFor={id} style={{
      display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px',
      marginBottom: '8px', cursor: 'pointer', userSelect: 'none',
    }}>
      <input
        id={id}
        type="checkbox"
        checked={useDocx}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 13, height: 13 }}
      />
      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
        Use Word format (.docx) instead of PDF — lets you edit the text after generating
      </span>
    </label>
  )
}
