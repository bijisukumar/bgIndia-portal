// ============================================================
//  StayTimesLine.jsx
//  One line saying when a guest is due in and out — used wherever guests are
//  listed (Complete booking, the home screen's Needs attention block, Raman's
//  check-in lists), so they all say the same thing. The villa's standard times
//  show for everyone, since that is the promise made to the guest; an agreed
//  early/late time, and what the guest typed on the check-in form, show
//  alongside, amber when they ask for more than the villa gives. Once a guest is
//  in the house only the check-out matters, so the arrival half drops away.
// ============================================================
import { stayTimes, PRE_ARRIVAL_STATUSES } from '../utils/stayTimes'
import { villaTimeDefaults } from '../utils/villaTimes'

export default function StayTimesLine({ stay, dim = 'var(--text-dim)', size = '0.68rem' }) {
  const t = stayTimes(stay, villaTimeDefaults())
  // A row with no status (not selected by that list) is treated as not yet arrived.
  const before = !stay.status || PRE_ARRIVAL_STATUSES.includes(String(stay.status).toLowerCase())
  const amber = '#F59E0B', blue = '#85B7EB'
  return (
    <div style={{ fontSize: size, marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '1px 10px' }}>
      {before && <span style={{ color: t.inEarly ? amber : dim }}>🔑 In {t.inTime}{t.inEarly ? ' (early)' : ''}</span>}
      <span style={{ color: t.outLate ? amber : dim }}>🧳 Out {t.outTime}{t.outLate ? ' (late)' : ''}</span>
      {before && t.eta && <span style={{ color: t.etaBeforeCheckin ? amber : blue }}>🚗 ETA {t.eta}</span>}
      {before && t.etd && <span style={{ color: t.etdAfterCheckout ? amber : blue }}>↗ leaving ~{t.etd}</span>}
      {t.needsReview && <span style={{ color: amber, fontWeight: '700' }}>⚠ review times</span>}
    </div>
  )
}
