// ============================================================
//  TimeAskHistory.jsx
//  What became of the times a guest asked for, as a short list:
//      🚫 Early check-in 2:00 PM — declined by Owner · 15 Nov, 10:20 AM
//         "Guest did not want to pay"
//  with the reason when one was given. Shown on Guest info (the owner) and on the
//  manager's check-in screen, so that when a guest says "we had asked for an early
//  check-in" the answer is on the stay: what was asked, what was decided, when, by
//  whom and why. Renders nothing for a stay with no decisions.
//
//  The lines come from the server as `stay.timeAsks` (declined, approved, agreed by
//  hand, taken back), read through stayTimes() in src/utils/stayTimes.js.
// ============================================================
import { stayTimes, askWords } from '../utils/stayTimes'
import { villaTimeDefaults } from '../utils/villaTimes'
import { fmtStamp } from '../utils/dates'

const TONE = { bad: '#EF9A9A', good: '#7BC89A', dim: '#9AA5B4' }

export default function TimeAskHistory({ stay, size = '0.72rem', label = 'TIME REQUESTS', dim = 'var(--text-dim)' }) {
  const t = stayTimes(stay || {}, villaTimeDefaults())
  if (!t.asks.length) return null
  return (
    <div>
      {label && (
        <div style={{ fontSize: '0.66rem', color: dim, fontWeight: '600', letterSpacing: '0.05em', marginBottom: '3px' }}>{label}</div>
      )}
      {t.asks.map((e, i) => {
        const w = askWords(e)
        return (
          <div key={i} style={{ fontSize: size, lineHeight: 1.5, marginTop: i ? '3px' : 0 }}>
            <span style={{ color: TONE[w.tone] || dim }}>{w.icon} {w.text}</span>
            {e.at && <span style={{ color: dim }}> · {fmtStamp(e.at)}</span>}
            {w.reason && <div style={{ color: dim, paddingLeft: '1.5em' }}>“{w.reason}”</div>}
          </div>
        )
      })}
    </div>
  )
}
