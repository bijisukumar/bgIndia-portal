// ============================================================
//  CalendarExports.jsx
//  The other half of the channel calendar. The feeds above bring each
//  platform's bookings IN; this gives every platform a private link of its
//  own to import in turn, so it blocks every night taken anywhere else. That
//  includes direct bookings, which no platform can learn about any other way.
//  A link never contains that platform's own bookings (it already knows them),
//  and carries dates only: no guest names or contact details.
//  Rendered inside ChannelCalendar (/owner/villa/channel-calendar).
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import { channelKey, channelLabel, sourcePill } from '../../utils/channel'
import { guestBaseUrl } from '../../utils/guestMessages'
import { timeAgo } from '../../utils/localWhen'

const DAY_MS = 24 * 3600 * 1000

const BTN = { padding: '6px 11px', borderRadius: '8px', fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap' }

export default function CalendarExports({ feeds, showToast }) {
  const [links, setLinks] = useState(null)        // null = still loading
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')            // the platform being worked on
  const [copied, setCopied] = useState(null)      // export id whose link was just copied
  const [other, setOther] = useState('')

  const load = () => api.getIcalExports(DEFAULT_VILLA_ID)
    .then(list => { setLinks(Array.isArray(list) ? list : []); setLoadError('') })
    .catch(e => { setLinks([]); setLoadError(e.message || 'Could not load') })

  useEffect(() => { load() }, [])

  // One row per platform: every platform with a feed above, plus any that has a
  // link without one. Grouped by the same normalised name the server uses, so
  // "Booking.com" and "booking_com" are one row.
  const rows = useMemo(() => {
    const byKey = new Map()
    for (const f of feeds || []) {
      const k = channelKey(f.channel)
      if (k && !byKey.has(k)) byKey.set(k, { key: k, channel: f.channel, link: null })
    }
    for (const l of links || []) {
      const k = channelKey(l.channel)
      const row = byKey.get(k) || { key: k, channel: l.channel, link: null }
      row.link = l
      byKey.set(k, row)
    }
    return [...byKey.values()].sort((a, b) => channelLabel(a.channel).localeCompare(channelLabel(b.channel)))
  }, [feeds, links])

  const urlOf = l => `${guestBaseUrl()}/api/ical/${l.token}.ics`

  async function run(key, work, failure) {
    setBusy(key)
    try { await work(); await load() }
    catch (e) { showToast(`${failure}: ${e.message}`, 'error') }
    finally { setBusy('') }
  }

  const create = channel => run(channelKey(channel), () => api.createIcalExport({ villaId: DEFAULT_VILLA_ID, channel }), 'Could not make the link')

  function renew(l) {
    const name = channelLabel(l.channel)
    if (!window.confirm(`Make a new link for ${name}?\n\nThe old one stops working at once, so the new one has to be pasted into ${name}.`)) return
    run(channelKey(l.channel), () => api.regenerateIcalExport({ exportId: l.exportId }), 'Could not replace the link')
  }

  function remove(l) {
    const name = channelLabel(l.channel)
    if (!window.confirm(`Remove the ${name} link?\n\n${name} will stop hearing about nights booked elsewhere. Remove the import inside ${name}'s own calendar settings as well.`)) return
    run(channelKey(l.channel), () => api.deleteIcalExport({ exportId: l.exportId }), 'Could not remove the link')
  }

  async function copy(l) {
    const url = urlOf(l)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(l.exportId)
      // Only clear our own tick, so a second tap inside the window is not wiped by the first one's timer.
      setTimeout(() => setCopied(c => (c === l.exportId ? null : c)), 2000)
    } catch {
      // Clipboard refused: hand over the whole link in a box that can be copied by hand.
      window.prompt('Copy this link', url)
    }
  }

  function status(l) {
    const name = channelLabel(l.channel)
    if (!l.lastFetchedAt) return { text: `Not read yet. Paste it into ${name}'s calendar import.`, warn: false }
    const quiet = Date.now() - new Date(l.lastFetchedAt).getTime() > DAY_MS
    return {
      text: `Read ${timeAgo(l.lastFetchedAt)} · ${l.fetchCount} time${l.fetchCount === 1 ? '' : 's'}` +
        (quiet ? ` · not read for over a day: is it still pasted into ${name}?` : ''),
      warn: quiet,
    }
  }

  const INP = { flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: '8px', boxSizing: 'border-box', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.85rem' }

  return (
    <div style={{ marginTop: '18px' }}>
      <div className="card-section-label" style={{ marginBottom: '6px' }}>SHARE YOUR CALENDAR BACK</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: '10px' }}>
        Giving each platform its own link means it blocks the nights booked everywhere else, your direct
        bookings included. Paste the link into that platform's calendar import. A link never contains that
        platform's own bookings, and holds dates only: no guest names or contact details.
      </div>

      {links === null && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '14px', fontSize: '0.8rem' }}>Loading…</div>}
      {loadError && <div style={{ fontSize: '0.75rem', color: '#EF4444', marginBottom: '8px' }}>Could not load the links: {loadError}</div>}

      {links !== null && rows.length === 0 && !loadError && (
        <div style={{ textAlign: 'center', padding: '18px', color: 'var(--text-dim)', fontSize: '0.8rem', border: '1px dashed rgba(200,144,58,0.2)', borderRadius: '12px', marginBottom: '8px' }}>
          Connect a platform's calendar above, or add a platform below.
        </div>
      )}

      {rows.map(r => {
        const l = r.link
        const st = l ? status(l) : null
        const working = busy === r.key
        return (
          <div key={r.key} style={{ background: 'var(--dark-card)', border: '1px solid rgba(200,144,58,0.2)', borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ ...sourcePill(r.channel), fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>{channelLabel(r.channel)}</span>
              {l ? (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', opacity: working ? 0.5 : 1 }}>
                  <button onClick={() => copy(l)} disabled={working}
                    style={{ ...BTN, fontWeight: '700', border: '1px solid rgba(200,144,58,0.4)', background: copied === l.exportId ? 'rgba(52,168,83,0.15)' : 'rgba(200,144,58,0.12)', color: copied === l.exportId ? '#34A853' : 'var(--gold)' }}>
                    {copied === l.exportId ? '✅ Copied' : '📋 Copy link'}
                  </button>
                  <button onClick={() => renew(l)} disabled={working}
                    style={{ ...BTN, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)' }}>New link</button>
                  <button onClick={() => remove(l)} disabled={working}
                    style={{ ...BTN, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: '#EF4444' }}>Remove</button>
                </div>
              ) : (
                <button onClick={() => create(r.channel)} disabled={working}
                  style={{ ...BTN, fontWeight: '700', border: 'none', background: 'var(--gold)', color: '#1A202C', opacity: working ? 0.6 : 1 }}>
                  {working ? 'Making…' : 'Create link'}
                </button>
              )}
            </div>
            {l && (
              <>
                <div style={{ fontSize: '0.66rem', color: '#5C7080', marginTop: '7px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  …/api/ical/{l.token.slice(0, 6)}…{l.token.slice(-4)}.ics
                </div>
                <div title={l.lastFetchAgent || ''} style={{ fontSize: '0.68rem', marginTop: '3px', color: st.warn ? '#F59E0B' : 'var(--text-dim)' }}>{st.text}</div>
              </>
            )}
          </div>
        )
      })}

      {links !== null && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <input value={other} onChange={e => setOther(e.target.value)} placeholder="Another platform, e.g. expedia" style={INP}
            onKeyDown={e => { if (e.key === 'Enter' && other.trim() && !busy) { create(other.trim()); setOther('') } }} />
          <button onClick={() => { create(other.trim()); setOther('') }} disabled={!other.trim() || !!busy}
            style={{ ...BTN, padding: '9px 14px', fontWeight: '700', border: 'none', background: 'var(--gold)', color: '#1A202C', opacity: !other.trim() || busy ? 0.5 : 1 }}>
            Create link
          </button>
        </div>
      )}

      <details style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--gold)' }}>Where do I paste it?</summary>
        <div style={{ marginTop: '6px' }}>
          Open the platform's calendar settings and look for <b>Import calendar</b> (some call it Connect or Sync calendars).
          <ul style={{ margin: '6px 0 6px', paddingLeft: '18px' }}>
            <li><b>Airbnb:</b> Calendar → Availability → Connect calendars → Connect to another website.</li>
            <li><b>Agoda:</b> Partner Portal → Calendar → Calendar connections → Other website link.</li>
            <li><b>Vrbo:</b> Calendar → Import/Export → Import calendar.</li>
            <li><b>Booking.com and Expedia:</b> Calendar → Sync calendars / Connect calendars.</li>
          </ul>
          Booking.com and Agoda only offer this when the villa is listed as a single unit, and Booking.com not at all if a
          channel manager is connected. Platforms read the link on their own schedule (Airbnb about every 3 hours), so a
          new booking can take a few hours to show up on the others; nothing here can make that instant.
        </div>
      </details>
    </div>
  )
}
