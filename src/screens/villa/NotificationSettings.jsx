import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

// This screen edits rows in villa_settings - a generic key/value store.
// To add a new configurable item later (for this villa or a newly onboarded
// one), add a field block here bound to a new key; no schema change or
// backend redeploy is needed, since the table already supports arbitrary keys.
export default function NotificationSettings() {
  const navigate = useNavigate()
  const villaId  = 'dwarka'

  const [ownerEmailAlert, setOwnerEmailAlert] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState(null)

  const [alertLog, setAlertLog]         = useState([])
  const [loadingLog, setLoadingLog]     = useState(true)

  const showToast = (msg, t = 'success') => { setToast({ msg, t }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    api.getVillaSettings(villaId)
      .then(s => setOwnerEmailAlert(s?.owner_email_alert || ''))
      .catch(() => showToast('Failed to load settings', 'error'))
      .finally(() => setLoading(false))
    loadAlertLog()
  }, [])

  function loadAlertLog() {
    setLoadingLog(true)
    api.getAlertLog(20)
      .then(d => setAlertLog(Array.isArray(d) ? d : []))
      .catch(() => setAlertLog([]))
      .finally(() => setLoadingLog(false))
  }

  async function handleSave() {
    if (!ownerEmailAlert || !/\S+@\S+\.\S+/.test(ownerEmailAlert)) {
      showToast('Enter a valid email address', 'error'); return
    }
    setSaving(true)
    try {
      await api.saveVillaSetting({ villaId, key: 'owner_email_alert', value: ownerEmailAlert })
      showToast('Saved ✓')
    } catch (e) { showToast(e?.message || 'Failed to save', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">Notification Settings</div><div className="topbar-sub">DWARKA</div></div>
      </div>

      <div className="screen-body">
        <div className="card-section-label">OWNER ALERT EMAIL</div>
        <div className="card">
          <div className="field" style={{ marginBottom: '4px' }}>
            <label className="field-label">Where check-in, check-out, kitchen incidentals and villa expense emails are sent</label>
            <input className="field-input" type="email" placeholder="owner@example.com"
              value={loading ? '' : ownerEmailAlert}
              onChange={e => setOwnerEmailAlert(e.target.value)}
              disabled={loading} />
          </div>
          <div style={{ color: '#5C7080', fontSize: '0.72rem', marginTop: '4px' }}>
            This is per-villa — when onboarding a new villa/owner later, this is the only
            place that needs to change. No code or redeploy required.
          </div>
        </div>

        <button className="btn btn-gold" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving...' : 'Save →'}
        </button>

        <div className="card-section-label" style={{ marginTop: '18px' }}>
          RECENT EMAIL ATTEMPTS
          <span style={{ float: 'right', cursor: 'pointer', color: '#185FA5', textTransform: 'none', fontWeight: '600' }} onClick={loadAlertLog}>
            ↻ Refresh
          </span>
        </div>

        {loadingLog && <div style={{ textAlign: 'center', color: '#5C7080', padding: '16px', fontSize: '0.82rem' }}>Loading…</div>}

        {!loadingLog && alertLog.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#5C7080', fontSize: '0.82rem', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            No email attempts logged yet — trigger a check-in, check-out, kitchen
            incidental, or villa expense save to see one appear here.
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
              {row.status_code && <span style={{ fontSize: '0.68rem', color: '#5C7080' }}>HTTP {row.status_code}</span>}
              <span style={{ fontSize: '0.68rem', color: '#5C7080', marginLeft: 'auto' }}>{row.created_at}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#9AA5B4', marginBottom: row.error_detail ? '3px' : 0 }}>
              {row.subject} → {row.to_email}
            </div>
            {row.error_detail && (
              <div style={{ fontSize: '0.7rem', color: '#EF9A9A', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                {row.error_detail}
              </div>
            )}
          </div>
        ))}
      </div>
      {toast && <div className={`toast ${toast.t}`}>{toast.msg}</div>}
    </div>
  )
}

