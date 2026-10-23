// Wording for the owner screens that show when something happened (the Training Manual's banner and
// access screen, the Channel calendar's links). A stamp arrives either as an ISO string with a zone
// ("…Z") or as D1's bare 'YYYY-MM-DD HH:MM:SS' (UTC); both are read as the moment they are and shown
// as the clock at the PROPERTY (its `timezone` setting, utils/tz.js), not the viewer's device.
//
// Standalone functions with their options fixed inside, deliberately not
// fmtDate(date, options): the production minifier has been seen dropping that
// helper's second argument (see CompleteBooking), which would silently print the
// wrong format.
import { getPropertyZone } from './dates'
import { instantMs, stampLong, stampShort } from './tz'

// Milliseconds since 1970 for the stamp, or null if it is not one.
function moment(iso) {
  const ms = instantMs(iso)
  return Number.isFinite(ms) ? ms : null
}

// "Tue, 14 Oct 2026, 6:00 PM IST"
export function whenLong(iso) {
  if (!iso) return ''
  const ms = moment(iso)
  return ms === null ? String(iso) : stampLong(ms, getPropertyZone())
}

// "14 Oct, 6:00 PM"
export function whenShort(iso) {
  if (!iso) return ''
  const ms = moment(iso)
  return ms === null ? String(iso) : stampShort(ms, getPropertyZone())
}

// "45 min left" · "6 hours left" · "3 days left" · "expired"
export function timeLeft(iso) {
  const at = moment(iso)
  const ms = at === null ? 0 : at - Date.now()
  if (!(ms > 0)) return 'expired'
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min left`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} left`
  return `${Math.round(h / 24)} days left`
}

// "just now" · "12 min ago" · "5 hours ago" · "3 days ago"
export function timeAgo(iso) {
  const at = moment(iso)
  if (at === null) return ''
  const min = Math.round((Date.now() - at) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} ago`
  return `${Math.round(h / 24)} days ago`
}
