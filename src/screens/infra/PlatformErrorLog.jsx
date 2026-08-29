import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

// created_at is stored 'YYYY-MM-DD HH:MM:SS' UTC with no timezone marker —
// mark it UTC explicitly before formatting, same fix as NotificationSettings.
function fmtLocalTime(utcStr) {
  if (!utcStr) return '—'
  try {
    const d = new Date(utcStr.replace(' ', 'T') + 'Z')
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    })
  } catch { return utcStr }
}

const EVENT_COLORS = {
  error:   '#EF4444',
  warning: '#F59E0B',
  success: '#34A853',
  info:    '#85B7EB',
}

const EVENT_TYPES = ['', 'error', 'warning', 'info', 'success']

// Master-owner-only, cross-tenant. Two independent logs, shown together
// since both answer the same question ("what's going wrong on the
// platform, across every tenant, without me having to go looking"):
//   - infra_processing_log: script/backend errors and warnings — no
//     read path existed anywhere before this screen.
//   - infra_alert_log: every email send attempt, success or failure —
//     already existed, but was neither scoped nor owner-gated, and its
//     only prior UI (NotificationSettings) was pinned to one villa.
export default function PlatformErrorLog() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('processing')  // 'processing' | 'alerts'

  const [procLog, setProcLog]         = useState([])
  const [loadingProc, setLoadingProc] = useState(true)
  const [eventType, setEventType]     = useState('')

  const [alertLog, setAlertLog]         = useState([])
  const [loadingAlert, setLoadingAlert] = useState(true)

  function loadProcessingLog() {
    setLoadingProc(true)
    api.getProcessingLog({ eventType: eventType || undefined, limit: 200 })
      .then(d => setProcLog(Array.isArray(d) ? d : []))
      .catch(() => setProcLog([]))
      .finally(() => setLoadingProc(false))
  }

  function loadAlertLog() {
    setLoadingAlert(true)
    api.getAlertLog(100)
      .then(d => setAlertLog(Array.isArray(d) ? d : []))
      .catch(() => setAlertLog([]))
      .finally(() => setLoadingAlert(false))
  }

  useEffect(() => { loadProcessingLog() }, [eventType])
  useEffect(() => { loadAlertLog() }, [])

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">Platform Error Log</div><div className="topbar-sub">MASTER OWNER · ALL TENANTS</div></div>
      </div>

      <div className="screen-body">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button onClick={() => setTab('processing')}
            style={{ flex: 1, padding: '9px', borderRadius: '9px', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem',
              border: `1px solid ${tab === 'processing' ? 'var(--gold)' : 'var(--border-dim)'}`,
              background: tab === 'processing' ? 'rgba(200,144,58,0.12)' : 'transparent',
              color: tab === 'processing' ? 'var(--gold)' : 'var(--text-dim)' }}>
            Processing Errors
          </button>
          <button onClick={() => setTab('alerts')}
            style={{ flex: 1, padding: '9px', borderRadius: '9px', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem',
              border: `1px solid ${tab === 'alerts' ? 'var(--gold)' : 'var(--border-dim)'}`,
              background: tab === 'alerts' ? 'rgba(200,144,58,0.12)' : 'transparent',
              color: tab === 'alerts' ? 'var(--gold)' : 'var(--text-dim)' }}>
            Email Alerts
          </button>
        </div>

        {tab === 'processing' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <select value={eventType} onChange={e => setEventType(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--dark-input)',
                border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.78rem' }}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t ? t[0].toUpperCase() + t.slice(1) : 'All types'}</option>)}
            </select>
            <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#185FA5', fontWeight: '600', fontSize: '0.78rem' }} onClick={loadProcessingLog}>
              ↻ Refresh
            </span>
          </div>

          {loadingProc && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '16px', fontSize: '0.82rem' }}>Loading…</div>}

          {!loadingProc && procLog.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: '0.82rem', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
              Nothing logged{eventType ? ` for "${eventType}"` : ''} — good sign.
            </div>
          )}

          {procLog.map(row => {
            const color = EVENT_COLORS[row.event_type] || 'var(--text-dim)'
            return (
              <div key={row.log_id} style={{
                background: 'var(--dark-card)', border: '1px solid var(--border-dim)',
                borderRadius: '10px', padding: '10px 12px', marginBottom: '6px', borderLeft: `3px solid ${color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.75rem', color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {row.event_type}
                  </span>
                  {row.villa_id && <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{row.villa_id}</span>}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>{fmtLocalTime(row.created_at)}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text)', wordBreak: 'break-word' }}>
                  {row.note}
                </div>
                {(row.stay_id || row.guest_name) && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '3px' }}>
                    {row.guest_name || ''}{row.guest_name && row.stay_id ? ' · ' : ''}{row.stay_id || ''}
                  </div>
                )}
              </div>
            )
          })}
        </>)}

        {tab === 'alerts' && (<>
          <div style={{ display: 'flex', marginBottom: '10px' }}>
            <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#185FA5', fontWeight: '600', fontSize: '0.78rem' }} onClick={loadAlertLog}>
              ↻ Refresh
            </span>
          </div>

          {loadingAlert && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '16px', fontSize: '0.82rem' }}>Loading…</div>}

          {!loadingAlert && alertLog.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: '0.82rem', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
              No email attempts logged yet.
            </div>
          )}

          {alertLog.map(row => (
            <div key={row.log_id} style={{
              background: 'var(--dark-card)', border: '1px solid var(--border-dim)',
              borderRadius: '10px', padding: '10px 12px', marginBottom: '6px',
              borderLeft: `3px solid ${row.success ? '#34A853' : '#EF4444'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.82rem', color: row.success ? '#34A853' : '#EF4444' }}>
                  {row.success ? '✓ Sent' : '✕ Failed'}
                </span>
                {row.villa_id && <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{row.villa_id}</span>}
                {row.category && <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{row.category}</span>}
                {row.status_code && <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>HTTP {row.status_code}</span>}
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>{fmtLocalTime(row.created_at)}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: row.error_detail ? '3px' : 0 }}>
                {row.subject} → {row.to_email}
              </div>
              {row.error_detail && (
                <div style={{ fontSize: '0.7rem', color: '#EF9A9A', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                  {row.error_detail}
                </div>
              )}
            </div>
          ))}
        </>)}
      </div>
    </div>
  )
}
