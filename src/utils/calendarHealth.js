// Is every calendar in step with StayVibe? The answer behind the red warning on Home and on the Channel calendar, and behind the email
// that goes out when it turns red. A night booked on one platform reaches the others only through calendars, and nothing says so when
// one stops: the platform quietly sells a night that is already taken. So this looks for every way the plumbing can go quiet:
//   - a platform has stopped reading OUR link (it is the only way it learns of bookings made elsewhere),
//   - we cannot read a platform's calendar (a booking made there would not block the others),
//   - a calendar we read has been paused, or a platform whose bookings come only as calendar dates has no calendar connected,
//   - a job that works from your mailbox (the Airbnb email reader) has stopped reporting in.
// Pure (no clock of its own, no database): the Worker feeds it rows, the screens and the tests share it. No platform is named here:
// names, how often a platform reads, and how long a silence is tolerated come from the partner files (calendar.readsEvery,
// calendar.staleAfterHours) and the host's own config (`calendarWatch`, below).
import { channelKey, channelLabel, partnerFor } from './partners.js'
import { instantMs } from './tz.js'

// How long a silence is tolerated when the partner file does not say. A host can override any of them with `calendarWatch` in config.js.
export const WATCH_DEFAULTS = Object.freeze({
  linkStaleHours: 12,        // a platform that reads our link has not done so for this long
  linkFirstReadHours: 48,    // a link was made this long ago and has never been read
  feedStaleHours: 12,        // we have not managed to read a platform's calendar for this long
  jobMinMinutes: 15,         // a job's silence is never judged under this, whatever its schedule
  jobMissedRuns: 4,          // ...and a job is quiet after this many runs in a row went missing
})

const positive = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d }

export function watchSettings(config) {
  const w = (config && config.calendarWatch) || {}
  return Object.fromEntries(Object.entries(WATCH_DEFAULTS).map(([k, d]) => [k, positive(w[k], d)]))
}

// How many hours a platform may go without reading our link before it counts as quiet: its own figure (calendar.staleAfterHours in its
// partner file), else the host's default. The warning and the link rows on the Channel calendar both use it, so they never disagree.
export function linkStaleHours(config, channel) {
  const cal = (partnerFor(config, channel) || {}).calendar || {}
  return positive(cal.staleAfterHours, watchSettings(config).linkStaleHours)
}

// Stored times ('YYYY-MM-DD HH:MM:SS', UTC with no zone mark) are read the one way the app reads them: utils/tz.js.
const toMs = instantMs

// '25 minutes', '14 hours', '3 days'
export function spanText(ms) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 90) return `${Math.max(1, minutes)} minutes`
  const hours = Math.round(ms / 3600000)
  if (hours < 48) return `${hours} hours`
  return `${Math.round(hours / 24)} days`
}

const HOUR = 3600000, MINUTE = 60000

/**
 * feeds: [{ channel, isActive, status ('ok'|'error'|null), error, lastGoodAt, createdAt }]   our reads of a platform's calendar
 *        (lastGoodAt = the last time a read WORKED; the caller works it out, a failed attempt does not move it)
 * links: [{ channel, createdAt, rotatedAt, lastFetchedAt }]                                  a platform reading OUR link
 * jobs:  [{ job, label, everyMinutes, lastRunAt, lastOkAt, lastStatus }]                      a Google script reporting in
 * Returns { checkedAt, worst: 'ok' | 'notice' | 'risk', ok, problems: [{ key, kind, severity, platform, short, title, detail }] }
 *   `short` is the same every time the same thing is wrong (it names no duration), so an alert can be sent once per problem;
 *   `title` says how long.
 */
export function evaluateCalendarHealth({ config, now, feeds = [], links = [], jobs = [] }) {
  const nowMs = Number.isFinite(now) ? now : Date.now()
  const w = watchSettings(config)
  const problems = []
  const add = p => problems.push({ severity: 'risk', ...p })

  const feedKeys = new Set()
  for (const f of feeds) {
    const label = channelLabel(f.channel)
    const key = channelKey(f.channel)
    feedKeys.add(key)
    if (f.isActive === 0 || f.isActive === false) {
      add({
        key: `feed_paused:${key}`, kind: 'feed_paused', severity: 'notice', platform: label,
        short: `${label}'s calendar is paused`,
        title: `${label}'s calendar is paused`,
        detail: `While it is paused, a night booked on ${label} is not passed on to your other platforms. Resume it on the Channel calendar when you want it back.`,
      })
      continue
    }
    const lastGood = toMs(f.lastGoodAt)
    const limit = w.feedStaleHours * HOUR
    const seenFor = Number.isFinite(lastGood) ? nowMs - lastGood : null
    const madeFor = Number.isFinite(toMs(f.createdAt)) ? nowMs - toMs(f.createdAt) : null
    const why = f.status === 'error' && f.error ? ` The last try failed: ${String(f.error).slice(0, 160)}.` : ''
    if (seenFor !== null) {
      if (seenFor > limit) {
        add({
          key: `feed_failing:${key}`, kind: 'feed_failing', platform: label,
          short: `StayVibe cannot read ${label}'s calendar`,
          title: `StayVibe has not been able to read ${label}'s calendar for ${spanText(seenFor)}`,
          detail: `A booking made on ${label} may not block your other platforms until it is read again.${why} Check the calendar link under Connected feeds on the Channel calendar, and press Sync now.`,
        })
      }
    } else if (f.status === 'error') {
      // The last try failed and nothing says when a read last WORKED (an empty calendar leaves no booking to date it by, and the record of
      // good reads does not exist before its table does). One failed try is common (a platform is slow, a request times out), so this is
      // told, not shouted: it is not a risk until a good read is known and old.
      if (madeFor === null || madeFor > HOUR) {
        add({
          key: `feed_unreadable:${key}`, kind: 'feed_unreadable', severity: 'notice', platform: label,
          short: `The last try to read ${label}'s calendar failed`,
          title: `The last try to read ${label}'s calendar failed`,
          detail: `StayVibe keeps trying.${why} It becomes a warning if ${label}'s calendar cannot be read for ${w.feedStaleHours} hours.`,
        })
      }
    } else if (madeFor !== null && madeFor > limit) {
      // never read at all, and made long enough ago for the first read to have happened
      add({
        key: `feed_failing:${key}`, kind: 'feed_failing', platform: label,
        short: `StayVibe cannot read ${label}'s calendar`,
        title: `StayVibe has never managed to read ${label}'s calendar`,
        detail: `A booking made on ${label} may not block your other platforms until it is read. Check the calendar link under Connected feeds on the Channel calendar, and press Sync now.`,
      })
    }
  }

  for (const l of links) {
    const label = channelLabel(l.channel)
    const key = channelKey(l.channel)
    const partner = partnerFor(config, l.channel) || {}
    const cal = partner.calendar || {}
    const lastRead = toMs(l.lastFetchedAt)
    const made = toMs(l.rotatedAt) || toMs(l.createdAt)
    if (!Number.isFinite(lastRead)) {
      const age = Number.isFinite(made) ? nowMs - made : 0
      const where = cal.whereToPaste ? ` Paste it into ${label}: ${cal.whereToPaste}` : ` Paste it into ${label}'s calendar import.`
      if (age > w.linkFirstReadHours * HOUR) {
        add({
          key: `link_never_read:${key}`, kind: 'link_never_read', platform: label,
          short: `${label} has never read your calendar link`,
          title: `${label} has never read your calendar link (made ${spanText(age)} ago)`,
          detail: `Until it does, ${label} cannot know about nights booked elsewhere and may sell them.${cal.via === 'google-bridge' ? ' ' + (cal.notReadYet || '') : where} If you will not use this link, remove it on the Channel calendar and this goes away.`,
        })
      } else {
        add({
          key: `link_waiting:${key}`, kind: 'link_waiting', severity: 'notice', platform: label,
          short: `${label} has not read its link yet`,
          title: `${label} has not read its calendar link yet`,
          detail: `The link was made ${Number.isFinite(made) ? spanText(age) + ' ago' : 'recently'}.${cal.via === 'google-bridge' ? '' : where}`,
        })
      }
    } else {
      const quiet = nowMs - lastRead
      const limit = linkStaleHours(config, l.channel) * HOUR
      if (quiet > limit) {
        add({
          key: `link_quiet:${key}`, kind: 'link_quiet', platform: label,
          short: `${label} is not reading your calendar link`,
          title: `${label} has not read your calendar link for ${spanText(quiet)}`,
          detail: `It usually reads ${cal.readsEvery || 'every few hours'}. Until it reads again, a night booked on another platform can still be sold on ${label}: a double booking. ${cal.quietWarning ? 'Check: ' + cal.quietWarning : `Check that the link is still in ${label}'s calendar import.`}`,
        })
      }
    }
    // A platform whose bookings come only as calendar dates, that IS reading our link, and whose calendar we do not read: a booking there
    // blocks nothing. (A link nobody has pasted anywhere yet is told above, not here; and a platform that cannot give a calendar of its
    // own says so in its partner file or the host's config, `calendar.noFeed`, and is not asked for one.)
    if (partner.bookingsFrom === 'calendar' && !cal.noFeed && Number.isFinite(lastRead) && !feedKeys.has(key)) {
      add({
        key: `no_feed:${key}`, kind: 'no_feed', platform: label,
        short: `StayVibe does not read ${label}'s calendar`,
        title: `StayVibe does not read ${label}'s calendar`,
        detail: `${label} bookings reach StayVibe only as dates on its calendar, and none is connected here, so a booking made on ${label} will not block your other platforms. Add its calendar link with + Feed on the Channel calendar.`,
      })
    }
  }

  for (const j of jobs) {
    const label = j.label || j.job
    const every = positive(j.everyMinutes, 5)
    const limit = Math.max(w.jobMinMinutes, w.jobMissedRuns * every) * MINUTE
    const ran = toMs(j.lastRunAt)
    if (!Number.isFinite(ran)) continue
    if (nowMs - ran > limit) {
      add({
        key: `job_silent:${j.job}`, kind: 'job_silent', platform: label,
        short: `${label} has stopped reporting`,
        title: `${label} has not reported for ${spanText(nowMs - ran)}`,
        detail: `It runs every ${every} minutes. While it is silent, the emails it reads (new bookings, cancellations, change requests) wait unprocessed. Open its project at script.google.com and look at its executions and triggers.`,
      })
    } else if (j.lastStatus === 'error') {
      const lastOk = toMs(j.lastOkAt)
      if (!Number.isFinite(lastOk) || nowMs - lastOk > limit) {
        add({
          key: `job_failing:${j.job}`, kind: 'job_failing', platform: label,
          short: `${label} is failing`,
          title: Number.isFinite(lastOk) ? `${label} has not finished a clean run for ${spanText(nowMs - lastOk)}` : `${label} has never finished a clean run`,
          detail: `It is running but ending in an error, so the emails it reads are not being handled. Open its project at script.google.com and read the latest execution.`,
        })
      }
    }
  }

  const rank = p => (p.severity === 'risk' ? 0 : 1)
  problems.sort((a, b) => rank(a) - rank(b))
  const worst = problems.some(p => p.severity === 'risk') ? 'risk' : problems.length ? 'notice' : 'ok'
  return { checkedAt: new Date(nowMs).toISOString(), worst, ok: worst !== 'risk', problems }
}
