import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { localTodayStr, parseLocalDate } from '../../utils/dates'

const PAVUTUMURI = CONFIG.estates.find(e => e.id === 'pavutumuri')
const DEFAULT_TAPPING_RATE = String(PAVUTUMURI?.tappingRate ?? 2.75)

function mondayOf(dateStr) {
  const d = parseLocalDate(dateStr) || new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr, n) {
  const d = parseLocalDate(dateStr); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function dayLabel(dateStr) {
  const d = parseLocalDate(dateStr)
  return d ? d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) : dateStr
}
function emptyDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => ({ date: addDays(weekStart, i), treeCount: '', sheetCount: '', ottupalCount: '', block: '', rain: false }))
}
function wkTotals(w) {
  const rate = parseFloat(w.rate) || 0
  const t = w.days.reduce((a, c) => ({
    tree: a.tree + (parseInt(c.treeCount) || 0),
    sheet: a.sheet + (parseInt(c.sheetCount) || 0),
    ottupal: a.ottupal + (parseInt(c.ottupalCount) || 0),
    rainDays: a.rainDays + (c.rain ? 1 : 0),
  }), { tree: 0, sheet: 0, ottupal: 0, rainDays: 0 })
  t.wages = Math.round(t.tree * rate * 100) / 100
  return t
}

export default function RubberTracker() {
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState(mondayOf(localTodayStr()))
  const [workers, setWorkers] = useState([{ name: 'Satishan', rate: DEFAULT_TAPPING_RATE, days: emptyDays(mondayOf(localTodayStr())) }])
  const [active, setActive] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const rosterRef = useRef(['Satishan'])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  useEffect(() => { rosterRef.current = workers.map(w => w.name) }, [workers])

  function buildWorkers(weekStart, rows) {
    const dbNames = [...new Set(rows.map(r => r.worker_name))]
    let names = [...new Set([...rosterRef.current.filter(Boolean), ...dbNames])]
    if (!names.length) names = ['Satishan']
    return names.map(name => {
      // Tapping rate: captured once per tapper — prefill from the most recent
      // saved row for this worker, default from CONFIG
      const workerRows = rows.filter(r => r.worker_name === name)
      const lastRate = workerRows.map(r => r.tapping_rate).filter(x => x > 0).pop()
      return {
        name,
        rate: lastRate ? String(lastRate) : DEFAULT_TAPPING_RATE,
        days: emptyDays(weekStart).map(cell => {
          const hit = workerRows.find(r => r.prod_date === cell.date)
          return hit
            ? { ...cell, treeCount: String(hit.tree_count || ''), sheetCount: String(hit.sheet_count || ''),
                ottupalCount: String(hit.ottupal_count || ''), block: hit.block || '', rain: !!hit.rain }
            : cell
        }),
      }
    })
  }

  function fetchWeek(ws) {
    setLoading(true)
    return api.getRubberProduction({ weekStart: ws })
      .then(d => { setWorkers(buildWorkers(ws, d?.rows || [])); setActive(0) })
      .catch(e => { showToast(e?.message || 'Failed to load saved data — showing blank week', 'error'); setWorkers(buildWorkers(ws, [])) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { let alive = true; fetchWeek(weekStart); return () => { alive = false } }, [weekStart]) // eslint-disable-line

  const setName = (i, val) => setWorkers(ws => ws.map((w, idx) => idx === i ? { ...w, name: val } : w))
  const setRate = (i, val) => setWorkers(ws => ws.map((w, idx) => idx === i ? { ...w, rate: val } : w))
  const setCell = (di, key, val) => setWorkers(ws => ws.map((w, idx) => idx === active ? { ...w, days: w.days.map((c, j) => j === di ? { ...c, [key]: val } : c) } : w))
  const addWorker = () => { setWorkers(ws => { setActive(ws.length); return [...ws, { name: '', days: emptyDays(weekStart) }] }) }
  const removeWorker = (i) => { if (workers.length <= 1) return; setWorkers(ws => ws.filter((_, idx) => idx !== i)); setActive(0) }
  const shiftWeek = (n) => setWeekStart(ws => addDays(ws, n * 7))

  const cur = workers[active] || workers[0]
  const curT = cur ? wkTotals(cur) : { tree: 0, sheet: 0, ottupal: 0 }
  const grand = workers.reduce((a, w) => { const t = wkTotals(w); return { tree: a.tree + t.tree, sheet: a.sheet + t.sheet, ottupal: a.ottupal + t.ottupal, wages: Math.round((a.wages + t.wages) * 100) / 100 } }, { tree: 0, sheet: 0, ottupal: 0, wages: 0 })

  async function handleSave() {
    const rows = []
    workers.forEach(w => {
      const name = (w.name || '').trim(); if (!name) return
      const rate = parseFloat(w.rate) || 0
      w.days.forEach(c => {
        const t = parseInt(c.treeCount) || 0, s = parseInt(c.sheetCount) || 0, o = parseInt(c.ottupalCount) || 0
        if (t || s || o || c.rain) rows.push({
          workerName: name, date: c.date, treeCount: t, sheetCount: s, ottupalCount: o,
          block: c.block || null, rain: c.rain ? 1 : 0, tappingRate: rate,
        })
      })
    })
    if (!rows.length) { showToast('Enter at least one entry', 'error'); return }
    setSaving(true)
    try {
      const r = await api.saveRubberProduction({ estate: 'pavutumuri', weekStart, rows })
      showToast(`Saved ${r?.saved ?? rows.length} record(s) ✓`)
      fetchWeek(weekStart)
    } catch (e) { showToast(e?.message || 'Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const cellInput = { width: '100%', padding: '9px 4px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border-dim)', background: 'var(--dark-input)', color: '#EDF2F7', fontSize: '0.9rem', fontFamily: "'DM Sans',sans-serif" }
  const arrowBtn = { flex: '0 0 auto', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: '8px', background: 'var(--dark-input)', color: '#9AA5B4', border: '1px solid var(--border-dim)', fontSize: '1.1rem', lineHeight: 1, cursor: 'pointer' }
  const isToday = (d) => d === localTodayStr()

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">Rubber tracker</div><div className="topbar-sub">PAVUTUMURI ESTATE · DAILY PRODUCTION</div></div>
      </div>

      <div className="screen-body">
        <div className="card-section-label">WEEK</div>
        <div className="card">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Week starting (Mon)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
              <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week" style={arrowBtn}>‹</button>
              <input className="field-input gold" type="date" style={{ flex: '1 1 auto', minWidth: 0 }} value={weekStart} onChange={e => setWeekStart(mondayOf(e.target.value))} />
              <button type="button" onClick={() => shiftWeek(1)} aria-label="Next week" style={arrowBtn}>›</button>
            </div>
          </div>
        </div>

        <div className="card-section-label">TAPPERS {loading && '· loading…'}</div>
        {/* Worker pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {workers.map((w, i) => {
            const t = wkTotals(w)
            return (
              <button key={i} onClick={() => setActive(i)} style={{
                padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600,
                border: `1px solid ${active === i ? '#0F6E56' : 'rgba(255,255,255,0.12)'}`,
                background: active === i ? 'rgba(15,110,86,0.18)' : 'transparent',
                color: active === i ? '#5FD0AE' : '#9AA5B4',
              }}>{w.name || `Tapper ${i + 1}`}{(t.sheet || t.tree) ? ` · ${t.sheet}s/${t.tree}t` : ''}</button>
            )
          })}
          <button onClick={addWorker} style={{ padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600, border: '1px dashed rgba(200,144,58,0.5)', background: 'transparent', color: '#C8903A' }}>+ Tapper</button>
        </div>

        {/* Active worker name editor */}
        <div className="card">
          <div className="field" style={{ marginBottom: '10px' }}>
            <label className="field-label">Tapper name &amp; rate (₹/tree)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="field-input" style={{ flex: 1 }} placeholder="e.g. Satishan" value={cur?.name || ''} onChange={e => setName(active, e.target.value)} />
              <input className="field-input" type="number" inputMode="decimal" step="0.05" placeholder={DEFAULT_TAPPING_RATE}
                style={{ flex: '0 0 84px', textAlign: 'center' }} value={cur?.rate || ''} onChange={e => setRate(active, e.target.value)} />
              {workers.length > 1 && (
                <button onClick={() => removeWorker(active)} style={{ padding: '0 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>Remove</button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.72fr 0.78fr 0.78fr 0.78fr 0.5fr', gap: '5px', marginBottom: '8px', fontSize: '0.6rem', color: '#5C7080', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <div>Day</div><div style={{ textAlign: 'center' }}>Block</div><div style={{ textAlign: 'center' }}>Trees</div><div style={{ textAlign: 'center' }}>Sheets</div><div style={{ textAlign: 'center' }}>Ottupal</div><div style={{ textAlign: 'center' }}>Rain</div>
          </div>
          {(cur?.days || []).map((c, di) => (
            <div key={c.date} style={{ display: 'grid', gridTemplateColumns: '1fr 0.72fr 0.78fr 0.78fr 0.78fr 0.5fr', gap: '5px', alignItems: 'center', marginBottom: '6px', opacity: c.rain ? 0.75 : 1 }}>
              <div style={{ fontSize: '0.72rem', color: c.rain ? '#5B8DBE' : isToday(c.date) ? '#C8903A' : '#9AA5B4', fontWeight: isToday(c.date) ? 700 : 500 }}>{dayLabel(c.date)}{c.rain ? ' ☔' : ''}</div>
              <select style={{ ...cellInput, padding: '9px 2px' }} value={c.block} onChange={e => setCell(di, 'block', e.target.value)}>
                <option value="">—</option><option value="A">A</option><option value="B">B</option><option value="AB">AB</option>
              </select>
              <input style={cellInput} type="number" inputMode="numeric" placeholder="0" value={c.treeCount} onChange={e => setCell(di, 'treeCount', e.target.value)} />
              <input style={cellInput} type="number" inputMode="numeric" placeholder="0" value={c.sheetCount} onChange={e => setCell(di, 'sheetCount', e.target.value)} />
              <input style={cellInput} type="number" inputMode="numeric" placeholder="0" value={c.ottupalCount} onChange={e => setCell(di, 'ottupalCount', e.target.value)} />
              <button type="button" onClick={() => setCell(di, 'rain', !c.rain)} title="Rain — no tapping" style={{
                ...cellInput, cursor: 'pointer', padding: '8px 2px',
                background: c.rain ? 'rgba(91,141,190,0.25)' : 'var(--dark-input)',
                border: c.rain ? '1px solid #5B8DBE' : '1px solid var(--border-dim)',
              }}>{c.rain ? '☔' : '·'}</button>
            </div>
          ))}
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.76rem', color: '#9AA5B4', display: 'flex', justifyContent: 'space-between' }}>
            <span>{cur?.name || 'This tapper'} · week</span>
            <span style={{ color: '#EDF2F7', fontWeight: 600 }}>{curT.tree} trees · {curT.sheet} sheets · {curT.ottupal} ottupal · ₹{(curT.wages || 0).toLocaleString('en-IN')} wages</span>
          </div>
        </div>

        <div className="net-box">
          <div className="net-row"><span className="net-label">All tappers · trees</span><span className="net-val">{grand.tree.toLocaleString('en-IN')}</span></div>
          <div className="net-row"><span className="net-label">All tappers · rubber sheets</span><span className="net-val pos">{grand.sheet.toLocaleString('en-IN')}</span></div>
          <div className="net-row"><span className="net-label">All tappers · wages (trees × rate)</span><span className="net-val">₹{(grand.wages || 0).toLocaleString('en-IN')}</span></div>
          <div className="net-divider" />
          <div className="net-row">
            <span style={{ color: '#EDF2F7', fontWeight: 600, fontSize: '1rem' }}>All tappers · ottupal</span>
            <span className="net-val big pos">{grand.ottupal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <button className="btn btn-teal" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save week (all tappers) →'}</button>
        <p className="btn-email-note">📧 Wages recorded as an expense · owner emailed on save · record sheet/ottupal sales separately on the P&amp;L dashboard</p>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
