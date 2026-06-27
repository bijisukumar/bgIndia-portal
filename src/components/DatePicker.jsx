import { useState, useRef, useEffect } from 'react'
import { parseLocalDate, localTodayStr } from '../utils/dates'

/**
 * DatePicker — calendar-grid popover, used in place of the native
 * <input type="date"> where the native control's tiny tap targets make it
 * easy to miss-click (e.g. clicking the field padding does nothing, only
 * the mm/dd/yyyy segments or the small icon respond). Touch-friendly: every
 * day cell is a full-size tappable button, works identically on mobile.
 *
 * Props:
 *   value      — "YYYY-MM-DD" string or '' (matches native date input value shape)
 *   onChange   — (newValue: string) => void — receives "YYYY-MM-DD" or '' on Clear
 *   placeholder — shown when value is empty (default "Select date")
 *   min/max    — optional "YYYY-MM-DD" bounds, days outside are disabled
 */
export default function DatePicker({ value, onChange, placeholder = 'Select date', min, max }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseLocalDate(value) || new Date())
  const wrapRef = useRef(null)

  useEffect(() => {
    if (value) {
      const d = parseLocalDate(value)
      if (d) setViewDate(d)
    }
  }, [value])

  // Close on outside click/tap
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const minDate = min ? parseLocalDate(min) : null
  const maxDate = max ? parseLocalDate(max) : null

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = localTodayStr()

  const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)

  const isDisabled = (day) => {
    const d = new Date(year, month, day)
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  const pick = (day) => {
    if (isDisabled(day)) return
    const d = new Date(year, month, day)
    onChange(toStr(d))
    setOpen(false)
  }

  const shiftMonth = (delta) => setViewDate(new Date(year, month + delta, 1))

  const displayLabel = value
    ? (parseLocalDate(value)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) || placeholder)
    : placeholder

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="field-input"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          textAlign: 'left', cursor: 'pointer',
          color: value ? 'var(--text)' : 'var(--text-dim)',
        }}
      >
        <span>{displayLabel}</span>
        <span style={{ fontSize: '1rem', opacity: 0.7 }}>📅</span>
      </button>

      {open && (
        <div style={s.popover}>
          <div style={s.header}>
            <button type="button" onClick={() => shiftMonth(-1)} style={s.navBtn}>‹</button>
            <div style={s.monthLabel}>{viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>
            <button type="button" onClick={() => shiftMonth(1)} style={s.navBtn}>›</button>
          </div>

          <div style={s.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} style={s.weekCell}>{d}</div>)}
          </div>

          <div style={s.grid}>
            {cells.map((day, i) => {
              if (day === null) return <div key={i} style={s.dayCell} />
              const d = new Date(year, month, day)
              const dStr = toStr(d)
              const selected = dStr === value
              const isToday = dStr === todayStr
              const disabled = isDisabled(day)
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => pick(day)}
                  disabled={disabled}
                  style={{
                    ...s.dayCell,
                    ...s.dayBtn,
                    ...(selected ? s.daySelected : {}),
                    ...(isToday && !selected ? s.dayToday : {}),
                    ...(disabled ? s.dayDisabled : {}),
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div style={s.footer}>
            <button type="button" style={s.footerBtn} onClick={() => { onChange(todayStr); setOpen(false) }}>Today</button>
            <button type="button" style={{ ...s.footerBtn, color: 'var(--text-dim)' }} onClick={() => { onChange(''); setOpen(false) }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  popover: {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
    background: 'var(--dark-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
    padding: '12px', width: '280px', maxWidth: '92vw',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  navBtn: {
    background: 'rgba(200,144,58,0.1)', border: '1px solid var(--border)', borderRadius: '8px',
    color: 'var(--gold-light)', width: '32px', height: '32px', fontSize: '1.1rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  monthLabel: { color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 },
  weekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' },
  weekCell: { textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.68rem', fontWeight: 700, padding: '4px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' },
  dayCell: { aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dayBtn: {
    width: '100%', height: '100%', minHeight: '36px',
    background: 'transparent', border: 'none', borderRadius: '8px',
    color: 'var(--text)', fontSize: '0.85rem', cursor: 'pointer',
  },
  daySelected: { background: 'var(--gold)', color: '#1A1300', fontWeight: 700 },
  dayToday: { border: '1px solid var(--gold)', color: 'var(--gold-light)' },
  dayDisabled: { color: 'var(--text-dim)', opacity: 0.35, cursor: 'not-allowed' },
  footer: { display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-dim)' },
  footerBtn: {
    background: 'none', border: 'none', color: 'var(--gold-light)', fontSize: '0.8rem',
    fontWeight: 600, cursor: 'pointer', padding: '6px 4px',
  },
}
