// The same-day turnover box on a guest's row (Complete booking's "Select guest", Raman's check-in lists and the banner of the guest in the house on
// his home screen): one guest leaves on the day another arrives, so the villa has hours, not a night, to be cleaned and reset. It sits on BOTH
// guests, so it cannot be missed whichever of them is on screen.
// Amber always; red when the hours between the two are fewer than the villa's own turnaround (or when they overlap). The rule, and the hours
// worked out from the times the guests were promised, are in src/utils/sameDayTurnover.js.
import { gapWords } from '../utils/sameDayTurnover'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// '2026-11-28' -> '28 Nov' (no Date, so no time zone can move it a day)
const dm = ymd => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${+m[3]} ${MONTHS[+m[2] - 1]}` : ''
}

// items: this guest's entries from sameDayTurnovers() (usually one). marginTop: the space above the box (0 when it opens a block of its own).
export default function TurnoverFlag({ items, marginTop = '6px' }) {
  if (!items || !items.length) return null
  return (
    <>
      {items.map(t => {
        const red = !!t.tight
        const gap = t.gapMinutes
        const gapText = gap === null || gap === undefined ? '' : gap < 0 ? `OVERLAP ${gapWords(gap).toUpperCase()}` : `${gapWords(gap).toUpperCase()} TO CLEAN`
        return (
          <div key={t.leaving.stayId + '>' + t.arriving.stayId} data-testid="turnover-flag"
            style={{ marginTop, padding: '7px 9px', borderRadius: '8px',
              background: red ? 'rgba(229,57,53,0.16)' : 'rgba(245,158,11,0.14)',
              border: `1px solid ${red ? 'rgba(229,57,53,0.55)' : 'rgba(245,158,11,0.45)'}` }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: red ? '#FF6B66' : '#F59E0B', letterSpacing: '0.5px' }}>
              ⚠️ SAME-DAY TURNAROUND · {dm(t.date).toUpperCase()}{gapText ? ` · ${gapText}` : ''}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#E8EDF3', marginTop: '2px', lineHeight: '1.45' }}>
              {t.leaving.guestName || 'A guest'} leaves {t.outTime}, {t.arriving.guestName || 'the next guest'} arrives {t.inTime}
            </div>
            {red && gap !== null && gap !== undefined && (
              <div style={{ fontSize: '0.66rem', color: '#FFB4B0', marginTop: '2px', lineHeight: '1.45' }}>
                {gap < 0 ? 'The two stays overlap. ' : ''}The villa needs {t.turnaroundHours} hours to be reset.
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
