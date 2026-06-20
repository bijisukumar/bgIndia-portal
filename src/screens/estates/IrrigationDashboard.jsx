// ============================================================
//  IrrigationDashboard.jsx
//  Zone health: green/yellow/orange/red based on missed cycles
//  Visible to both owner and estate manager
// ============================================================
import { useState, useEffect } from 'react'
import { api } from '../../api'
import { parseLocalDate } from '../../utils/dates'

function fmtDate(d) {
  if (!d) return 'Never'
  try { return parseLocalDate(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return d }
}

function ZoneCard({ zone }) {
  const { zone_name, zone_label, expected_freq_days, last_logged, days_since, consecutive_misses, status } = zone

  const COLOR = {
    ok:     { bg:'rgba(52,168,83,0.08)',   border:'rgba(52,168,83,0.3)',   text:'#34A853', label:'ON TRACK' },
    warn:   { bg:'rgba(245,158,11,0.08)',  border:'rgba(245,158,11,0.35)', text:'#F59E0B', label:'1 MISS' },
    alert:  { bg:'rgba(234,112,32,0.08)',  border:'rgba(234,112,32,0.4)',  text:'#EA7020', label:'2 MISSES' },
    critical:{ bg:'rgba(239,68,68,0.08)', border:'rgba(239,68,68,0.45)',  text:'#EF4444', label:'3+ MISSES' },
    never:  { bg:'rgba(239,68,68,0.12)',   border:'rgba(239,68,68,0.5)',   text:'#EF4444', label:'NEVER LOGGED' },
  }

  const c = COLOR[status] || COLOR.ok

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '12px', padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      {/* Status dot */}
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%',
        background: c.text, flexShrink: 0,
        boxShadow: `0 0 8px ${c.text}`,
      }}/>

      {/* Zone info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#EDF2F7' }}>{zone_name}</span>
          {zone_label && (
            <span style={{ fontSize: '0.62rem', color: '#5C7080', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '6px' }}>
              {zone_label}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#5C7080' }}>
          Last: {fmtDate(last_logged)}
          {days_since !== null && ` · ${days_since}d ago`}
          {` · Every ${expected_freq_days}d`}
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        padding: '4px 10px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700',
        letterSpacing: '1px', color: c.text,
        background: `${c.text}18`, border: `1px solid ${c.text}40`,
        flexShrink: 0,
      }}>
        {c.label}
      </div>
    </div>
  )
}

export default function IrrigationDashboard({ estate = 'pollachi' }) {
  const [zones, setZones]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [lastRun, setLastRun]   = useState(null)

  useEffect(() => { load() }, [estate])

  async function load() {
    setLoading(true)
    try {
      const d = await api.getIrrigationZoneHealth(estate)
      setZones(Array.isArray(d?.zones) ? d.zones : [])
      setLastRun(d?.lastRun || null)
    } catch(e) { setZones([]) }
    finally { setLoading(false) }
  }

  const critical  = zones.filter(z => z.status === 'critical' || z.status === 'never')
  const alerts    = zones.filter(z => z.status === 'alert')
  const warns     = zones.filter(z => z.status === 'warn')
  const ok        = zones.filter(z => z.status === 'ok')

  const overallStatus = critical.length > 0 ? 'critical'
    : alerts.length > 0 ? 'alert'
    : warns.length > 0 ? 'warn' : 'ok'

  const SUMMARY_COLOR = { ok:'#34A853', warn:'#F59E0B', alert:'#EA7020', critical:'#EF4444' }
  const SUMMARY_MSG = {
    ok:       '✅ All zones on track',
    warn:     `⚠️ ${warns.length} zone${warns.length>1?'s':''} missed 1 cycle`,
    alert:    `🟠 ${alerts.length} zone${alerts.length>1?'s':''} missed 2 cycles`,
    critical: `🔴 ${critical.length} zone${critical.length>1?'s':''} critically overdue`,
  }

  if (loading) return (
    <div style={{ textAlign:'center', color:'#5C7080', padding:'16px', fontSize:'0.8rem' }}>
      Loading irrigation zones…
    </div>
  )

  if (zones.length === 0) return (
    <div style={{ background:'rgba(24,95,165,0.06)', border:'1px solid rgba(24,95,165,0.2)', borderRadius:'12px', padding:'16px', textAlign:'center' }}>
      <div style={{ color:'#5C7080', fontSize:'0.82rem', marginBottom:'6px' }}>💧 No irrigation zones configured yet</div>
      <div style={{ color:'#5C7080', fontSize:'0.72rem' }}>
        Run the irrigation zones migration and add zones for {estate}
      </div>
    </div>
  )

  return (
    <div style={{ marginBottom: '14px' }}>
      {/* Summary banner */}
      <div style={{
        background: `${SUMMARY_COLOR[overallStatus]}10`,
        border: `1px solid ${SUMMARY_COLOR[overallStatus]}35`,
        borderRadius: '10px', padding: '10px 14px',
        marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: '600', fontSize: '0.82rem', color: SUMMARY_COLOR[overallStatus] }}>
          {SUMMARY_MSG[overallStatus]}
        </span>
        {lastRun && (
          <span style={{ fontSize: '0.68rem', color: '#5C7080' }}>
            Last log: {fmtDate(lastRun)}
          </span>
        )}
      </div>

      {/* Zone legend */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { color:'#34A853', label:'On track' },
          { color:'#F59E0B', label:'1 miss' },
          { color:'#EA7020', label:'2 misses' },
          { color:'#EF4444', label:'3+ misses' },
        ].map(l => (
          <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.65rem', color:'#9AA5B4' }}>
            <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:l.color, boxShadow:`0 0 5px ${l.color}` }}/>
            {l.label}
          </div>
        ))}
      </div>

      {/* Zone cards — sorted by severity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[...critical, ...alerts, ...warns, ...ok].map(z => (
          <ZoneCard key={z.zone_id} zone={z}/>
        ))}
      </div>
    </div>
  )
}
