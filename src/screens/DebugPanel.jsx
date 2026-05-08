import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { logger } from '../utils/logger'
import { CONFIG } from '../config'

const LEVEL_COLORS = {
  error: '#EF9A9A',
  warn:  '#FFD54F',
  info:  '#81C995',
}

export default function DebugPanel() {
  const navigate  = useNavigate()
  const [logs, setLogs]     = useState([])
  const [apiTest, setApiTest] = useState(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setLogs(logger.getAll())
  }, [])

  const [copied, setCopied] = useState(false)

  const handleClear = () => {
    logger.clear()
    setLogs([])
  }

  const handleCopy = () => {
    const text = logs.map(log =>
      `[${log.level.toUpperCase()}] ${new Date(log.time).toLocaleTimeString('en-IN')} | ${log.context} | ${log.message}${log.stack ? ' | ' + log.stack : ''}`
    ).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleRefresh = () => {
    setLogs(logger.getAll())
  }

  const testApi = async () => {
    setTesting(true)
    setApiTest(null)
    const start = Date.now()
    try {
      const res = await fetch(CONFIG.appsScriptUrl + '?action=ping')
      const ms  = Date.now() - start
      const json = await res.json()
      setApiTest({ ok: true, ms, status: res.status, data: json })
      logger.info('DebugPanel', 'API test succeeded', { ms })
    } catch (err) {
      const ms = Date.now() - start
      setApiTest({ ok: false, ms, error: err.message })
      logger.error('DebugPanel', err, { context: 'API test' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Debug panel</div>
          <div className="topbar-sub">OWNER ONLY · ERROR LOG</div>
        </div>
        <button onClick={handleRefresh} style={styles.refreshBtn}>↻</button>
      </div>

      <div className="screen-body">

        {/* API STATUS TEST */}
        <div className="card-section-label">API CONNECTION</div>
        <div className="card">
          <div style={{fontSize:'0.78rem',color:'var(--text-dim)',marginBottom:'10px',wordBreak:'break-all'}}>
            {CONFIG.appsScriptUrl.slice(0,60)}...
          </div>
          <button className="btn btn-blue" onClick={testApi} disabled={testing} style={{marginBottom: apiTest ? '12px' : 0}}>
            {testing ? 'Testing...' : 'Test API connection'}
          </button>
          {apiTest && (
            <div style={{
              background: apiTest.ok ? 'rgba(52,168,83,0.08)' : 'rgba(229,57,53,0.08)',
              border: `1px solid ${apiTest.ok ? 'rgba(52,168,83,0.25)' : 'rgba(229,57,53,0.25)'}`,
              borderRadius: '8px', padding: '10px 12px',
            }}>
              <div style={{color: apiTest.ok ? 'var(--green)' : 'var(--red)', fontWeight:'600', marginBottom:'4px'}}>
                {apiTest.ok ? '✓ Connected' : '✗ Failed'}  · {apiTest.ms}ms
              </div>
              {apiTest.ok
                ? <div style={{color:'var(--text-dim)',fontSize:'0.8rem'}}>Status: {apiTest.status} · {JSON.stringify(apiTest.data)}</div>
                : <div style={{color:'#EF9A9A',fontSize:'0.8rem'}}>{apiTest.error}</div>
              }
            </div>
          )}
        </div>

        {/* SESSION INFO */}
        <div className="card-section-label">SESSION INFO</div>
        <div className="card">
          {[
            ['Drive root',    CONFIG.driveRootId],
            ['Owner email',   CONFIG.ownerEmail],
            ['Villas',        CONFIG.villas.map(v=>v.name).join(', ')],
            ['Estates',       CONFIG.estates.map(e=>e.name).join(', ')],
            ['User agent',    navigator.userAgent.slice(0,60)+'...'],
            ['Online',        navigator.onLine ? '✓ Yes' : '✗ No'],
          ].map(([k,v]) => (
            <div key={k} style={styles.infoRow}>
              <span style={styles.infoKey}>{k}</span>
              <span style={styles.infoVal}>{v}</span>
            </div>
          ))}
        </div>

        {/* ERROR LOG */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <div className="card-section-label" style={{margin:0}}>
            ERROR LOG ({logs.length})
          </div>
          {logs.length > 0 && (
            <div style={{display:'flex',gap:'6px'}}>
              <button onClick={handleCopy} style={{
                ...styles.clearBtn,
                background: copied ? 'rgba(52,168,83,0.15)' : 'rgba(24,95,165,0.1)',
                border: copied ? '1px solid rgba(52,168,83,0.3)' : '1px solid rgba(24,95,165,0.25)',
                color: copied ? '#81C995' : '#85B7EB',
              }}>
                {copied ? '✓ Copied' : '📋 Copy all'}
              </button>
              <button onClick={handleClear} style={styles.clearBtn}>Clear</button>
            </div>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="card" style={{textAlign:'center',padding:'24px',color:'var(--text-dim)'}}>
            ✓ No errors logged this session
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="card" style={{
              marginBottom:'6px',
              borderLeft: `3px solid ${LEVEL_COLORS[log.level] || '#8A9BAE'}`,
              padding:'10px 12px',
            }}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                <span style={{color: LEVEL_COLORS[log.level], fontSize:'0.72rem', fontWeight:'700', textTransform:'uppercase'}}>
                  {log.level}
                </span>
                <span style={{color:'var(--text-dim)',fontSize:'0.7rem'}}>
                  {new Date(log.time).toLocaleTimeString('en-IN')}
                </span>
              </div>
              <div style={{color:'var(--text)',fontSize:'0.85rem',fontWeight:'500',marginBottom:'2px'}}>
                {log.context}
              </div>
              <div style={{color:'var(--text-dim)',fontSize:'0.78rem'}}>
                {log.message}
              </div>
              {log.stack && (
                <div style={{color:'#5C7080',fontSize:'0.7rem',marginTop:'4px',fontFamily:'monospace',wordBreak:'break-all'}}>
                  {log.stack}
                </div>
              )}
            </div>
          ))
        )}

      </div>
    </div>
  )
}

const styles = {
  refreshBtn: {
    background:'rgba(255,255,255,0.06)', border:'none', color:'var(--gold)',
    width:'34px', height:'34px', borderRadius:'50%', cursor:'pointer', fontSize:'1rem',
  },
  clearBtn: {
    background:'rgba(229,57,53,0.1)', border:'1px solid rgba(229,57,53,0.2)',
    color:'#EF9A9A', borderRadius:'6px', padding:'4px 10px',
    fontSize:'0.75rem', fontWeight:'600', cursor:'pointer',
  },
  infoRow: {
    display:'flex', justifyContent:'space-between', alignItems:'flex-start',
    padding:'6px 0', borderBottom:'1px solid var(--border-dim)',
  },
  infoKey: { color:'var(--text-dim)', fontSize:'0.78rem', flexShrink:0, marginRight:'12px' },
  infoVal: { color:'var(--text)', fontSize:'0.78rem', textAlign:'right', wordBreak:'break-all' },
}
