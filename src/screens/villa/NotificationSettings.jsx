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

  const showToast = (msg, t = 'success') => { setToast({ msg, t }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    api.getVillaSettings(villaId)
      .then(s => setOwnerEmailAlert(s?.owner_email_alert || ''))
      .catch(() => showToast('Failed to load settings', 'error'))
      .finally(() => setLoading(false))
  }, [])

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
      </div>
      {toast && <div className={`toast ${toast.t}`}>{toast.msg}</div>}
    </div>
  )
}
