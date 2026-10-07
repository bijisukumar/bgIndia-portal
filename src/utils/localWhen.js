// Local-time wording for the Training Manual screens (the manual's own banner
// and the owner's access screen). Timestamps arrive as ISO strings WITH a zone
// ("…Z") — the API adds it, because D1 stores UTC with none and a browser reads
// a bare string as local time — and are shown in the viewer's own timezone.
//
// Standalone functions with their options fixed inside, deliberately not
// fmtDate(date, options): the production minifier has been seen dropping that
// helper's second argument (see CompleteBooking), which would silently print the
// wrong format.

function parse(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

// "Tue, 14 Oct 2026, 6:00 pm IST"
export function whenLong(iso) {
  if (!iso) return ''
  const d = parse(iso)
  if (!d) return String(iso)
  return d.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
}

// "14 Oct, 6:00 pm"
export function whenShort(iso) {
  if (!iso) return ''
  const d = parse(iso)
  if (!d) return String(iso)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

// "45 min left" · "6 hours left" · "3 days left" · "expired"
export function timeLeft(iso) {
  const d = parse(iso)
  const ms = d ? d.getTime() - Date.now() : 0
  if (!(ms > 0)) return 'expired'
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min left`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} left`
  return `${Math.round(h / 24)} days left`
}
