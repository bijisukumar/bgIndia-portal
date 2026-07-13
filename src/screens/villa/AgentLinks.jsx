// ============================================================
//  AgentLinks.jsx
//  Owner-facing management for self-serve agent quote links.
//  Route: /owner/villa/agent-links
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'

export default function AgentLinks() {
  const navigate = useNavigate()
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ agentName: '', discountPct: '0' })
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState(null)
  const [copied, setCopied] = useState(null)
  const BASE = window.location.origin

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const d = await api.getAgentLinks(DEFAULT_VILLA_ID)
      setLinks(Array.isArray(d) ? d : [])
    } catch (e) { setLinks([]) }
    finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!form.agentName.trim()) { showToast('Agent name required', 'error'); return }
    setCreating(true)
    try {
      const d = await api.createAgentLink({
        agentName: form.agentName.trim(),
        discountPct: form.discountPct,
        villaId: DEFAULT_VILLA_ID,
      })
      showToast(`✅ Link created — token: ${d.token}`)
      setShowCreate(false)
      setForm({ agentName: '', discountPct: '0' })
      load()
    } catch (e) { showToast('Create failed: ' + e.message, 'error') }
    finally { setCreating(false) }
  }

  async function handleToggle(token) {
    try {
      await api.toggleAgentLink({ token })
      setLinks(ls => ls.map(l => l.token === token ? { ...l, is_active: l.is_active ? 0 : 1 } : l))
    } catch (e) { showToast('Failed', 'error') }
  }

  async function copyLink(token) {
    const url = `${BASE}/quote/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch { }
  }

  const INP = { width: '100%', padding: '9px 12px', borderRadius: '8px', boxSizing: 'border-box', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.9rem' }
  const LBL = { display: 'block', fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '4px' }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Agent quote links</div>
          <div className="topbar-sub">SELF-SERVE PRICING FOR PARTNERS</div>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'var(--gold)', color: '#1A202C', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}>
          {showCreate ? '✕' : '+ New'}
        </button>
      </div>

      <div className="screen-body">
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '14px', lineHeight: 1.5 }}>
          Give each travel agent or sales partner their own link. They can enter dates and
          guest counts to get an instant quote — no account needed, and no access to your
          full rate card. Set a discount to reward a specific partner.
        </div>

        {showCreate && (
          <div style={{ background: 'rgba(200,144,58,0.06)', border: '1px solid rgba(200,144,58,0.25)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ fontWeight: '700', color: 'var(--gold)', fontSize: '0.88rem', marginBottom: '12px' }}>New agent link</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={LBL}>AGENT / AGENCY NAME *</label>
                <input value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))}
                  placeholder="e.g. Detrip Holidays" style={INP} />
              </div>
              <div>
                <label style={LBL}>DISCOUNT %</label>
                <input type="number" min="0" max="100" value={form.discountPct}
                  onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))} style={INP} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating || !form.agentName.trim()}
                style={{ flex: 2, padding: '9px', borderRadius: '9px', border: 'none', background: 'var(--gold)', color: '#1A202C', fontWeight: '700', cursor: 'pointer', opacity: creating || !form.agentName.trim() ? 0.6 : 1 }}>
                {creating ? 'Creating…' : 'Create link'}
              </button>
            </div>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '24px', fontSize: '0.85rem' }}>Loading…</div>}

        {!loading && links.length === 0 && !showCreate && (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '0.85rem', border: '1px dashed rgba(200,144,58,0.2)', borderRadius: '12px' }}>
            No agent links yet.<br />
            <span style={{ fontSize: '0.75rem' }}>Tap "+ New" to create one for a travel agent or sales partner.</span>
          </div>
        )}

        {links.map(l => (
          <div key={l.token} style={{ background: 'var(--dark-card)', border: `1px solid ${l.is_active ? 'rgba(200,144,58,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: '12px', padding: '14px', marginBottom: '8px', opacity: l.is_active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text)' }}>{l.agent_name}</span>
                  {!l.is_active && <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '8px' }}>PAUSED</span>}
                  {l.discount_pct > 0 && <span style={{ fontSize: '0.62rem', color: '#34A853', background: 'rgba(52,168,83,0.12)', padding: '1px 6px', borderRadius: '8px', fontWeight: '700' }}>{l.discount_pct}% off</span>}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '3px', fontFamily: 'monospace' }}>
                  /quote/{l.token} · {l.use_count || 0} quote{l.use_count !== 1 ? 's' : ''} generated
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => copyLink(l.token)}
                  style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(200,144,58,0.35)', background: copied === l.token ? 'rgba(52,168,83,0.15)' : 'rgba(200,144,58,0.1)', color: copied === l.token ? '#34A853' : 'var(--gold)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}>
                  {copied === l.token ? '✅ Copied' : '📋 Copy'}
                </button>
                <button onClick={() => handleToggle(l.token)}
                  style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer' }}>
                  {l.is_active ? 'Pause' : 'Resume'}
                </button>
              </div>
            </div>
          </div>
        ))}

        <div style={{ height: '20px' }} />
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
