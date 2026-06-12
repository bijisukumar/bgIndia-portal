/**
 * Maintenance.jsx
 * Owner-only hub for system health, schema validation, and alert settings.
 * Route: /owner/maintenance
 */

import { useNavigate } from 'react-router-dom'

const ITEMS = [
  {
    icon: '✅',
    bg: 'rgba(52,168,83,0.08)',
    arrow: '#34A853',
    title: 'Schema validation',
    sub: 'Cross-check live DB columns against query contracts · catch mismatches before they break screens',
    path: '/owner/maintenance/schema',
  },
  {
    icon: '🔔',
    bg: 'rgba(200,144,58,0.08)',
    arrow: '#C8903A',
    title: 'Logging & alerts',
    sub: 'Configure alert email · set immediate vs daily digest · mute specific error types',
    path: '/owner/maintenance/alerts',
    badge: 'Coming soon',
  },
  {
    icon: '🗄️',
    bg: 'rgba(24,95,165,0.08)',
    arrow: '#185FA5',
    title: 'DB Explorer',
    sub: 'Run SQL queries · inspect tables · preset queries for common checks',
    path: '/infra/d1',
  },
  {
    icon: '🧪',
    bg: 'rgba(139,92,246,0.08)',
    arrow: '#8B5CF6',
    title: 'Test runner',
    sub: 'End-to-end flow tests · booking lifecycle · API connectivity',
    path: '/test',
  },
  {
    icon: '🐛',
    bg: 'rgba(92,112,128,0.08)',
    arrow: '#5C7080',
    title: 'Debug panel',
    sub: 'Session error log · API response inspection · connection test',
    path: '/debug',
  },
]

export default function Maintenance() {
  const navigate = useNavigate()

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Maintenance</div>
          <div className="topbar-sub">OWNER ONLY · SYSTEM TOOLS</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      <div className="screen-body">

        <div className="card-section-label">SYSTEM TOOLS</div>

        <div style={{
          background: '#1E2535', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden', marginBottom: '14px',
        }}>
          {ITEMS.map((item, i) => (
            <div
              key={item.title}
              className="menu-row"
              style={{
                padding: '14px 0',
                borderBottom: i < ITEMS.length - 1 ? '1px solid var(--border-dim)' : 'none',
                opacity: item.badge ? 0.6 : 1,
                cursor: item.badge ? 'default' : 'pointer',
              }}
              onClick={() => !item.badge && navigate(item.path)}
            >
              <div className="menu-icon" style={{ background: item.bg }}>{item.icon}</div>
              <div className="menu-label">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="menu-title">{item.title}</div>
                  {item.badge && (
                    <span style={{
                      fontSize: '0.62rem', fontWeight: '700', padding: '1px 6px',
                      borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
                      color: '#5C7080', letterSpacing: '0.04em',
                    }}>{item.badge}</span>
                  )}
                </div>
                <div className="menu-sub">{item.sub}</div>
              </div>
              {!item.badge && (
                <div className="menu-arrow" style={{ background: item.arrow }}>›</div>
              )}
            </div>
          ))}
        </div>

        <div style={{
          background: 'rgba(52,168,83,0.06)', border: '1px solid rgba(52,168,83,0.15)',
          borderRadius: '10px', padding: '10px 14px',
        }}>
          <div style={{ color: '#34A853', fontSize: '0.75rem', fontWeight: '600' }}>
            💡 Schema validation runs on every load
          </div>
          <div style={{ color: '#5C7080', fontSize: '0.72rem', marginTop: '2px' }}>
            The validation screen fetches the live DB schema via lightweight PRAGMA queries
            (no data rows read) and cross-checks all query contracts automatically.
            Zero cost, catches column mismatches before they reach guests.
          </div>
        </div>

      </div>
    </div>
  )
}
