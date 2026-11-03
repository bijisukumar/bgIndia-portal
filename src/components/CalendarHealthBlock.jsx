// The warning that a calendar has gone quiet: a platform that has stopped reading our link, a calendar we cannot read, a Google script
// that has stopped reporting in. A night booked on one platform reaches the others only through these, so while any is wrong a
// platform can sell a night that is already taken. Shown at the top of Home and of the Channel calendar, and nowhere when all is well.
// What counts as wrong is decided on the server (src/utils/calendarHealth.js, via getCalendarHealth); the same faults are emailed.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { DEFAULT_VILLA_ID } from '../utils/villaContext'

const REFRESH_MS = 5 * 60 * 1000

export default function CalendarHealthBlock({ showLink = true }) {
  const navigate = useNavigate()
  const [health, setHealth] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => api.getCalendarHealth(DEFAULT_VILLA_ID).then(d => { if (alive && d && Array.isArray(d.problems)) setHealth(d) }).catch(() => {})
    load()
    const timer = setInterval(load, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  if (!health || !health.problems.length) return null
  const risk = health.worst === 'risk'
  const tone = risk ? { main: '#EF4444', bg: 'rgba(239,68,68,0.08)', line: 'rgba(239,68,68,0.35)' } : { main: '#F59E0B', bg: 'rgba(245,158,11,0.07)', line: 'rgba(245,158,11,0.3)' }

  return (
    <div role="alert" data-testid="calendar-health" style={{ marginBottom: '16px', background: tone.bg, border: `1px solid ${tone.line}`, borderRadius: '12px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{risk ? '🚨' : '⚠️'}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: tone.main, letterSpacing: '1.2px' }}>
          {risk ? 'CALENDARS OUT OF STEP: A NIGHT THAT IS TAKEN MAY BE SOLD AGAIN' : 'CALENDAR NOTICE'}
        </span>
      </div>
      {health.problems.map(p => (
        <div key={p.key} style={{ marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${tone.line}` }}>
          <div style={{ fontSize: '0.82rem', fontWeight: '700', color: p.severity === 'risk' ? '#FCA5A5' : '#FCD34D' }}>{p.title}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', lineHeight: 1.5, marginTop: '3px' }}>{p.detail}</div>
        </div>
      ))}
      {showLink && (
        <button onClick={() => navigate('/owner/villa/channel-calendar')}
          style={{ marginTop: '12px', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${tone.line}`, background: 'transparent', color: tone.main, fontWeight: '700', fontSize: '0.76rem', cursor: 'pointer' }}>
          Open the Channel calendar ›
        </button>
      )}
    </div>
  )
}
