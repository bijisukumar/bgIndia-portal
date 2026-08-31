import { useState, useEffect } from 'react'
import { api } from '../api'
import { setActiveVillaId } from '../utils/villaContext'

// Shown right after login, before any protected screen mounts. If the
// logged-in user only has one property (today's real Dwarka case), this
// auto-selects it and resolves immediately with no visible UI — the
// picker only actually shows once a tenant owns 2+ properties, or for
// master_owner (who picks across every tenant for troubleshooting).
export default function PropertyPicker({ onResolved }) {
  const [options, setOptions]   = useState(null)
  const [isMaster, setIsMaster] = useState(false)
  const [error, setError]       = useState('')
  // master_owner accumulates every host on the platform, so this list only
  // grows. Typing to narrow it beats scrolling a list that will eventually
  // be dozens long.
  const [query, setQuery]       = useState('')

  useEffect(() => {
    api.getPropertyPickerOptions()
      .then(data => {
        const props = data?.properties || []
        if (props.length <= 1) {
          const only = props[0]?.propertyId
          if (only) setActiveVillaId(only)
          onResolved(only || null)
          return
        }
        setOptions(props)
        setIsMaster(!!data.isMasterOwner)
      })
      .catch(() => {
        // Never block the app on this — fall back to whatever
        // DEFAULT_VILLA_ID already resolved to at build time.
        onResolved(null)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (propertyId) => {
    setActiveVillaId(propertyId)
    onResolved(propertyId)
  }

  if (!options) return (
    <div style={styles.container}>
      <p style={styles.loading}>Loading properties…</p>
    </div>
  )

  // Match on host name and id too, not just the property name - an operator
  // looking for a tenant usually remembers the host, and the id is what shows
  // up in logs and error reports.
  const q = query.trim().toLowerCase()
  const matches = !q ? options : options.filter(p =>
    [p.name, p.propertyId, p.tenantName, p.tenantId]
      .some(v => String(v || '').toLowerCase().includes(q)))

  const grouped = isMaster
    ? matches.reduce((acc, p) => {
        (acc[p.tenantName] ||= []).push(p)
        return acc
      }, {})
    : { '': matches }

  // Enter picks when the search has narrowed to exactly one, so a known host
  // is a few keystrokes and a return rather than a hunt with the mouse.
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && matches.length === 1) choose(matches[0].propertyId)
    if (e.key === 'Escape') setQuery('')
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.title}>Select a property</p>
        {error && <p style={styles.error}>{error}</p>}
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search host or property…"
          style={styles.search}
        />
        {/* A dropdown rather than a stack of cards: at fifty hosts a stacked
            list is a scroll hunt, while a closed dropdown stays one line
            however many hosts exist. The search above narrows what is inside
            it, so typing "d" leaves only the d-hosts to choose between. */}
        <select
          style={styles.select}
          value=""
          disabled={matches.length === 0}
          onChange={e => { if (e.target.value) choose(e.target.value) }}
        >
          <option value="">
            {matches.length === 0
              ? 'No match — clear the search'
              : `Select a property… (${matches.length})`}
          </option>
          {Object.entries(grouped).map(([tenantName, props]) => (
            tenantName
              ? (
                <optgroup key={tenantName} label={tenantName}>
                  {props.map(p => (
                    <option key={p.propertyId} value={p.propertyId}>
                      {p.name || p.propertyId} · {p.unitType || 'villa'}
                    </option>
                  ))}
                </optgroup>
              )
              : props.map(p => (
                <option key={p.propertyId} value={p.propertyId}>
                  {p.name || p.propertyId} · {p.unitType || 'villa'}
                </option>
              ))
          ))}
        </select>
        {matches.length === 0 && (
          <p style={styles.empty}>No host or property matches “{query}”.</p>
        )}
        {isMaster && options.length > 1 && (
          <p style={styles.count}>
            {matches.length} of {options.length} {options.length === 1 ? 'property' : 'properties'}
          </p>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#111111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  loading: {
    color: '#8A9BAE',
    fontSize: '0.85rem',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    background: '#1E2535',
    borderRadius: '20px',
    padding: '28px 24px',
    border: '1px solid rgba(200,144,58,0.2)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
  },
  title: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#F0F0F0',
    marginBottom: '18px',
    textAlign: 'center',
  },
  error: {
    color: '#EF9A9A',
    fontSize: '0.8rem',
    marginBottom: '12px',
    textAlign: 'center',
  },
  select: {
    width: '100%',
    padding: '11px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(200,144,58,0.3)',
    background: '#141820',
    color: '#F0F0F0',
    fontSize: '16px',
    fontFamily: 'DM Sans, sans-serif',
    boxSizing: 'border-box',
    cursor: 'pointer',
    // The options popup is drawn by the OS, not by this page. Without this it
    // renders as white-on-white against the dark card.
    colorScheme: 'dark',
  },
  search: {
    width: '100%',
    padding: '10px 12px',
    marginBottom: '12px',
    borderRadius: '10px',
    border: '1px solid rgba(200,144,58,0.3)',
    background: '#141820',
    color: '#F0F0F0',
    // 16px keeps iOS from zooming the viewport when the field takes focus.
    fontSize: '16px',
    fontFamily: 'DM Sans, sans-serif',
    boxSizing: 'border-box',
    outline: 'none',
  },
  empty: {
    color: '#8A9BAE',
    fontSize: '0.8rem',
    textAlign: 'center',
    padding: '14px 4px',
  },
  count: {
    color: '#5C7080',
    fontSize: '0.68rem',
    textAlign: 'center',
    marginTop: '12px',
  },
  optionName: { fontWeight: '600' },
  optionType: { fontSize: '0.7rem', color: '#8A9BAE', textTransform: 'capitalize' },
}
