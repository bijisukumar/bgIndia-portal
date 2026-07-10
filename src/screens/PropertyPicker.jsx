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

  const grouped = isMaster
    ? options.reduce((acc, p) => {
        (acc[p.tenantName] ||= []).push(p)
        return acc
      }, {})
    : { '': options }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.title}>Select a property</p>
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.list}>
          {Object.entries(grouped).map(([tenantName, props]) => (
            <div key={tenantName || 'default'}>
              {tenantName && <p style={styles.groupLabel}>{tenantName}</p>}
              {props.map(p => (
                <button key={p.propertyId} style={styles.option} onClick={() => choose(p.propertyId)}>
                  <span style={styles.optionName}>{p.name || p.propertyId}</span>
                  <span style={styles.optionType}>{p.unitType || 'villa'}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  groupLabel: {
    fontSize: '0.65rem',
    color: '#5C7080',
    letterSpacing: '1.5px',
    fontWeight: '700',
    margin: '12px 0 6px',
  },
  option: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    background: '#141820',
    border: '1px solid rgba(200,144,58,0.2)',
    borderRadius: '10px',
    color: '#F0F0F0',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.85rem',
  },
  optionName: { fontWeight: '600' },
  optionType: { fontSize: '0.7rem', color: '#8A9BAE', textTransform: 'capitalize' },
}
