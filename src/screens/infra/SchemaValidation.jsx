/**
 * SchemaValidation.jsx
 * Maintenance > Schema Validation
 *
 * Fetches live DB schema via getSchemaSnapshot, then runs 3 checks:
 *  1. Required tables present
 *  2. Every contract column exists in the live table
 *  3. SELECT contracts — warns if a query fetches far fewer columns than exist
 *
 * On every load: snapshot is fetched fresh from D1 (lightweight PRAGMA queries,
 * negligible cost — ~15 small reads, no data rows).
 *
 * Manual re-run: "Run checks" button.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONTRACTS, REQUIRED_TABLES } from './schemaContracts'

// ── COLOURS ──────────────────────────────────────────────────
const C = {
  pass:    '#34A853',
  passBg:  'rgba(52,168,83,0.10)',
  warn:    '#F59E0B',
  warnBg:  'rgba(245,158,11,0.10)',
  fail:    '#EF4444',
  failBg:  'rgba(239,68,68,0.10)',
  info:    '#85B7EB',
  infoBg:  'rgba(133,183,235,0.08)',
  border:  'rgba(255,255,255,0.07)',
  dim:     '#5C7080',
  gold:    '#C8903A',
}

function Badge({ status, children }) {
  const map = {
    pass: { bg: C.passBg, color: C.pass },
    warn: { bg: C.warnBg, color: C.warn },
    fail: { bg: C.failBg, color: C.fail },
    info: { bg: C.infoBg, color: C.info },
  }
  const s = map[status] || map.info
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
      background: s.bg, color: s.color,
      fontSize: '0.68rem', fontWeight: '700', letterSpacing: '0.04em',
    }}>
      {children}
    </span>
  )
}

function SectionHeader({ icon, title, summary, status }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 14px',
      background: status === 'fail' ? C.failBg : status === 'warn' ? C.warnBg : C.passBg,
      borderBottom: `1px solid ${C.border}`,
      borderRadius: '10px 10px 0 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#EDF2F7' }}>{title}</span>
      </div>
      <Badge status={status}>{summary}</Badge>
    </div>
  )
}

// ── RUN CHECKS ───────────────────────────────────────────────
function runChecks(snapshot) {
  const results = { tables: [], contracts: [], completeness: [] }

  // CHECK 1 — required tables present
  for (const t of REQUIRED_TABLES) {
    const exists = !!snapshot[t]
    results.tables.push({ table: t, status: exists ? 'pass' : 'fail',
      msg: exists ? `${snapshot[t].length} columns` : 'TABLE MISSING FROM DB' })
  }

  // CHECK 2 — contract columns exist in live table
  for (const contract of CONTRACTS) {
    if (contract.columns.includes('*')) continue  // SELECT * always fine
    const liveTable = snapshot[contract.table]
    if (!liveTable) {
      results.contracts.push({
        action: contract.action, table: contract.table, type: contract.type,
        status: 'fail', missing: [], msg: `Table '${contract.table}' not found in DB`,
      })
      continue
    }
    const liveCols = new Set(liveTable.map(c => c.name))
    const missing = contract.columns.filter(c => !liveCols.has(c))
    results.contracts.push({
      action: contract.action, table: contract.table, type: contract.type,
      status: missing.length ? 'fail' : 'pass',
      missing,
      msg: missing.length
        ? `Missing: ${missing.join(', ')}`
        : `All ${contract.columns.length} columns present`,
    })
  }

  // CHECK 3 — completeness (SELECT queries fetching <50% of available columns)
  for (const contract of CONTRACTS) {
    if (contract.type !== 'SELECT') continue
    if (contract.columns.includes('*')) continue
    const liveTable = snapshot[contract.table]
    if (!liveTable) continue
    const total = liveTable.length
    const fetched = contract.columns.length
    const pct = Math.round((fetched / total) * 100)
    // Only warn if fetching less than 40% AND total > 10 cols (small tables are intentional)
    if (pct < 40 && total > 10) {
      results.completeness.push({
        action: contract.action, table: contract.table,
        fetched, total, pct,
        status: 'warn',
        msg: `Fetches ${fetched}/${total} columns (${pct}%) — screen may show missing data`,
        missing: liveTable.map(c => c.name).filter(c => !contract.columns.includes(c)),
      })
    } else {
      results.completeness.push({
        action: contract.action, table: contract.table,
        fetched, total, pct, status: 'pass',
        msg: `${fetched}/${total} columns (${pct}%)`,
        missing: [],
      })
    }
  }

  return results
}

// ── MAIN COMPONENT ───────────────────────────────────────────
export default function SchemaValidation() {
  const navigate = useNavigate()
  const [loading, setLoading]   = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [results, setResults]   = useState(null)
  const [error, setError]       = useState(null)
  const [lastRun, setLastRun]   = useState(null)
  const [expanded, setExpanded] = useState({ tables: true, contracts: true, completeness: false })

  const runValidation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSchemaSnapshot()
      setSnapshot(data.snapshot)
      setResults(runChecks(data.snapshot))
      setLastRun(new Date())
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { runValidation() }, [runValidation])

  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }))

  // Summary counts
  const failCount  = results
    ? [...results.tables, ...results.contracts].filter(r => r.status === 'fail').length
    : 0
  const warnCount  = results
    ? results.completeness.filter(r => r.status === 'warn').length
    : 0

  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : results ? 'pass' : 'info'
  const overallLabel  = !results ? 'Loading…'
    : failCount > 0 ? `${failCount} error${failCount>1?'s':''}`
    : warnCount > 0 ? `${warnCount} warning${warnCount>1?'s':''}`
    : 'All checks passed'
  const overallEmoji  = overallStatus === 'fail' ? '🔴' : overallStatus === 'warn' ? '🟡' : '🟢'

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Schema validation</div>
          <div className="topbar-sub">MAINTENANCE · DB CONTRACT CHECKS</div>
        </div>
        <button
          onClick={runValidation}
          disabled={loading}
          style={{
            background: 'rgba(200,144,58,0.12)', border: '1px solid rgba(200,144,58,0.3)',
            color: C.gold, borderRadius: '8px', padding: '6px 12px',
            fontSize: '0.75rem', fontWeight: '700', cursor: loading ? 'default' : 'pointer',
          }}>
          {loading ? '…' : '↻ Run'}
        </button>
      </div>

      <div className="screen-body">

        {/* Overall status card */}
        <div style={{
          padding: '14px 16px', borderRadius: '12px', marginBottom: '14px',
          background: overallStatus === 'fail' ? C.failBg : overallStatus === 'warn' ? C.warnBg : C.passBg,
          border: `1px solid ${overallStatus === 'fail' ? C.fail : overallStatus === 'warn' ? C.warn : C.pass}44`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#EDF2F7' }}>
              {overallEmoji} {overallLabel}
            </div>
            {lastRun && (
              <div style={{ fontSize: '0.72rem', color: C.dim, marginTop: '3px' }}>
                Last checked {lastRun.toLocaleTimeString('en-IN')}
                {snapshot && ` · ${Object.keys(snapshot).length} tables · ${CONTRACTS.length} contracts`}
              </div>
            )}
          </div>
          {error && (
            <div style={{ color: C.fail, fontSize: '0.78rem', maxWidth: '200px', textAlign: 'right' }}>
              {error}
            </div>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px', color: C.dim, fontSize: '0.85rem' }}>
            <div style={{ marginBottom: '8px', fontSize: '1.4rem' }}>⏳</div>
            Fetching live DB schema…
          </div>
        )}

        {!loading && results && (<>

          {/* ── CHECK 1: Required tables ─────────────────── */}
          <div style={{ borderRadius: '10px', border: `1px solid ${C.border}`, marginBottom: '10px', overflow: 'hidden' }}>
            <div onClick={() => toggle('tables')} style={{ cursor: 'pointer' }}>
              <SectionHeader
                icon="🗄️"
                title="Required tables"
                status={results.tables.some(r=>r.status==='fail') ? 'fail' : 'pass'}
                summary={`${results.tables.filter(r=>r.status==='pass').length}/${results.tables.length} present`}
              />
            </div>
            {expanded.tables && (
              <div>
                {results.tables.map((r, i) => (
                  <div key={r.table} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 14px',
                    borderBottom: i < results.tables.length-1 ? `1px solid ${C.border}` : 'none',
                    background: r.status === 'fail' ? C.failBg : 'transparent',
                  }}>
                    <div>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: r.status==='fail' ? C.fail : '#C9D1D9' }}>
                        {r.table}
                      </span>
                      {r.status === 'fail' && (
                        <div style={{ fontSize: '0.72rem', color: C.fail, marginTop: '2px' }}>
                          ⚠ {r.msg}
                        </div>
                      )}
                    </div>
                    <Badge status={r.status}>{r.status === 'fail' ? 'MISSING' : r.msg}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── CHECK 2: Contract columns ────────────────── */}
          <div style={{ borderRadius: '10px', border: `1px solid ${C.border}`, marginBottom: '10px', overflow: 'hidden' }}>
            <div onClick={() => toggle('contracts')} style={{ cursor: 'pointer' }}>
              <SectionHeader
                icon="🔗"
                title="Column contracts"
                status={results.contracts.some(r=>r.status==='fail') ? 'fail' : 'pass'}
                summary={`${results.contracts.filter(r=>r.status==='pass').length}/${results.contracts.length} passing`}
              />
            </div>
            {expanded.contracts && (
              <div>
                {results.contracts.map((r, i) => (
                  <div key={i} style={{
                    padding: '9px 14px',
                    borderBottom: i < results.contracts.length-1 ? `1px solid ${C.border}` : 'none',
                    background: r.status === 'fail' ? C.failBg : 'transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#C9D1D9' }}>
                            {r.action}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: C.dim }}>→ {r.table}</span>
                          <span style={{ fontSize: '0.65rem', color: C.dim,
                            background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '1px 5px' }}>
                            {r.type}
                          </span>
                        </div>
                        {r.status === 'fail' && (
                          <div style={{ marginTop: '5px' }}>
                            <div style={{ fontSize: '0.72rem', color: C.fail, marginBottom: '3px' }}>
                              Missing columns:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {r.missing.map(col => (
                                <span key={col} style={{
                                  fontFamily: 'monospace', fontSize: '0.7rem',
                                  background: C.failBg, color: C.fail,
                                  border: `1px solid ${C.fail}44`,
                                  borderRadius: '4px', padding: '1px 6px',
                                }}>{col}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Badge status={r.status}>
                        {r.status === 'fail' ? `${r.missing.length} missing` : 'OK'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── CHECK 3: Completeness ────────────────────── */}
          <div style={{ borderRadius: '10px', border: `1px solid ${C.border}`, marginBottom: '10px', overflow: 'hidden' }}>
            <div onClick={() => toggle('completeness')} style={{ cursor: 'pointer' }}>
              <SectionHeader
                icon="📊"
                title="Query completeness"
                status={results.completeness.some(r=>r.status==='warn') ? 'warn' : 'pass'}
                summary={`${results.completeness.filter(r=>r.status==='warn').length} thin queries`}
              />
            </div>
            {expanded.completeness && (
              <div>
                {results.completeness.length === 0 && (
                  <div style={{ padding: '14px', color: C.dim, fontSize: '0.82rem', textAlign: 'center' }}>
                    No SELECT contracts to check
                  </div>
                )}
                {results.completeness.map((r, i) => (
                  <div key={i} style={{
                    padding: '9px 14px',
                    borderBottom: i < results.completeness.length-1 ? `1px solid ${C.border}` : 'none',
                    background: r.status === 'warn' ? C.warnBg : 'transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#C9D1D9' }}>
                            {r.action}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: C.dim }}>→ {r.table}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: r.status==='warn' ? C.warn : C.dim, marginTop: '3px' }}>
                          {r.msg}
                        </div>
                        {r.status === 'warn' && r.missing.length > 0 && (
                          <div style={{ marginTop: '5px', fontSize: '0.7rem', color: C.dim }}>
                            Not fetched: {r.missing.slice(0,8).join(', ')}{r.missing.length > 8 ? ` +${r.missing.length-8} more` : ''}
                          </div>
                        )}
                      </div>
                      <Badge status={r.status}>{r.pct}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SNAPSHOT EXPLORER ───────────────────────── */}
          {snapshot && (
            <div style={{ marginTop: '6px' }}>
              <div className="card-section-label">LIVE SCHEMA SNAPSHOT</div>
              {Object.entries(snapshot).sort(([a],[b])=>a.localeCompare(b)).map(([table, cols]) => (
                <div key={table} style={{
                  background: 'var(--dark-card)', borderRadius: '8px',
                  border: `1px solid ${C.border}`, marginBottom: '6px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: C.gold, fontWeight: '700' }}>
                      {table}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: C.dim }}>{cols.length} cols</span>
                  </div>
                  <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {cols.map(c => (
                      <span key={c.name} style={{
                        fontFamily: 'monospace', fontSize: '0.68rem',
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid rgba(255,255,255,0.08)`,
                        borderRadius: '4px', padding: '2px 6px',
                        color: c.pk ? C.gold : c.notnull ? '#C9D1D9' : C.dim,
                      }}>
                        {c.pk ? '🔑 ' : ''}{c.name}
                        <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: '3px' }}>
                          {c.type?.toLowerCase()}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </>)}
      </div>
    </div>
  )
}
