import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

// Per-tenant storage usage, read from getTenantUsage.
//
// This exists because the platform runs every host in one shared database.
// That was a deliberate choice — keeping a database per host means a schema
// migration per host, and the demo tenant already proved how that fails by
// drifting nineteen columns behind and breaking. The trade is that growth is
// no longer visible per customer unless something measures it. This is that
// something.
//
// Document bytes are called out separately: passport and visa scans are
// stored base64 inside the row, so they are the one thing that can grow a
// tenant quickly. Everything else is text measured in kilobytes.

function fmtBytes(b) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

const S = {
  wrap:    { padding: '0 0 40px' },
  head:    { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  intro:   { color: '#9AA5B4', fontSize: '0.82rem', lineHeight: 1.6, margin: '10px 0 18px' },
  card:    { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
             borderRadius: 12, padding: '14px 16px', marginBottom: 12 },
  tenant:  { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
             gap: 10, marginBottom: 10 },
  name:    { fontWeight: 700, fontSize: '0.98rem' },
  rows:    { color: '#C8903A', fontWeight: 700, fontSize: '0.9rem',
             fontVariantNumeric: 'tabular-nums' },
  meta:    { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.76rem',
             color: '#9AA5B4', marginBottom: 10 },
  tbl:     { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th:      { textAlign: 'left', color: '#6B7280', fontWeight: 700, padding: '4px 6px',
             textTransform: 'uppercase', letterSpacing: '.06em', fontSize: '0.66rem' },
  td:      { padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.06)',
             color: '#C9D4E2' },
  tdNum:   { padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.06)',
             color: '#C9D4E2', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  more:    { color: '#6B7280', fontSize: '0.72rem', marginTop: 6 },
  msg:     { color: '#9AA5B4', fontSize: '0.85rem', padding: '18px 0' },
  err:     { color: '#EF4444', fontSize: '0.85rem', padding: '12px 14px',
             background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
             borderRadius: 10 },
  foot:    { color: '#6B7280', fontSize: '0.72rem', marginTop: 16, lineHeight: 1.6 },
}

export default function TenantUsage() {
  const navigate = useNavigate()
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.getTenantUsage()
      .then(d => { if (alive) setData(d) })
      .catch(e => { if (alive) setError(e?.message || 'Could not load usage') })
    return () => { alive = false }
  }, [])

  const totalRows = (data?.tenants || []).reduce((n, t) => n + t.rows, 0)
  const totalDocs = (data?.tenants || []).reduce((n, t) => n + (t.docBytes || 0), 0)

  return (
    <div className="screen">
      <div style={S.head}>
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <h2 style={{ margin: 0 }}>Tenant usage</h2>
      </div>

      <p style={S.intro}>
        What each host is storing in the shared database. Row counts come from
        every table carrying a <code>villa_id</code>, discovered from the schema
        rather than a fixed list — a table added later is counted without anyone
        remembering to add it here.
      </p>

      <div style={S.wrap}>
        {error && <div style={S.err}>{error}</div>}
        {!error && !data && <p style={S.msg}>Loading…</p>}

        {!error && data && (data.tenants || []).length === 0 && (
          <p style={S.msg}>No tenant data yet.</p>
        )}

        {!error && data && (data.tenants || []).map(t => {
          const tables = Object.entries(t.tables || {})
            .sort((a, b) => b[1] - a[1])
          const top = tables.slice(0, 8)
          return (
            <div key={t.villaId} style={S.card}>
              <div style={S.tenant}>
                <span style={S.name}>{t.villaId}</span>
                <span style={S.rows}>{t.rows.toLocaleString()} rows</span>
              </div>
              <div style={S.meta}>
                <span>{tables.length} table{tables.length === 1 ? '' : 's'} in use</span>
                <span>
                  Document scans:{' '}
                  <strong style={{ color: t.docBytes ? '#EAB308' : '#9AA5B4' }}>
                    {fmtBytes(t.docBytes)}
                  </strong>
                </span>
              </div>
              <table style={S.tbl}>
                <thead>
                  <tr><th style={S.th}>Table</th><th style={{ ...S.th, textAlign: 'right' }}>Rows</th></tr>
                </thead>
                <tbody>
                  {top.map(([name, n]) => (
                    <tr key={name}>
                      <td style={S.td}>{name.replace(/^stayvibe_/, '')}</td>
                      <td style={S.tdNum}>{n.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tables.length > top.length && (
                <p style={S.more}>+ {tables.length - top.length} more with fewer rows</p>
              )}
            </div>
          )
        })}

        {!error && data && (
          <p style={S.foot}>
            {data.scannedTables} villa-scoped tables scanned ·{' '}
            {totalRows.toLocaleString()} rows across all tenants ·{' '}
            {fmtBytes(totalDocs)} of scans.
            <br />
            Row counts are not bytes. Text rows are small; a tenant only grows
            quickly if passport and visa scans are being retained, which is why
            those are shown separately.
          </p>
        )}
      </div>
    </div>
  )
}
