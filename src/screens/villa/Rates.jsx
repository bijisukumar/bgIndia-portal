import { useState, useEffect, useMemo } from 'react'
import { useBack } from '../../utils/navTrail'
import { api } from '../../api'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import { localTodayStr } from '../../utils/dates'
import { estimateStay, validateSeason, validateRateCardRows, seasonPriceLabel, seasonDatesLabel } from '../../utils/seasonRates'
import { describeEstimate } from '../../utils/villaPricing'

// Rates & seasons (2026-10-28), owner only: the villa's nightly rate by party size, and busy seasons that change the price for a range
// of dates. New enquiry, Enquiry detail and the agent quote links read both (utils/seasonRates.js prices a stay night by night).

const rupees = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const dim = { color: 'var(--text-dim)', fontSize: '0.76rem' }
const smallBtn = { padding: '6px 11px', borderRadius: '8px', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '0.76rem', cursor: 'pointer' }

const draftFromCard = (rows, max) => Array.from({ length: max }, (_, i) => {
  const r = (rows || []).find(x => x.guests === i + 1)
  return { guests: i + 1, value: r ? String(r.tariff) : '' }
})

export default function Rates() {
  const goBack = useBack()
  const villaId = DEFAULT_VILLA_ID

  const [plan, setPlan] = useState(null)       // getRatePlan: rateCard, seasons, seasonsReady, maxGuests, overflowPerGuest, overflowMax
  const [loadError, setLoadError] = useState('')
  const [draft, setDraft] = useState([])       // the base rates as typed: [{ guests, value }]
  const [savingCard, setSavingCard] = useState(false)
  const [form, setForm] = useState(null)       // the season being added or edited, or null
  const [formError, setFormError] = useState('')
  const [savingSeason, setSavingSeason] = useState(false)
  const [tryIn, setTryIn] = useState({ checkIn: '', checkOut: '', adults: 10, children: 0 })
  const [toast, setToast] = useState(null)

  const showToast = (msg, t = 'success') => { setToast({ msg, t }); setTimeout(() => setToast(null), 3200) }

  const load = () => api.getRatePlan(villaId)
    .then(d => { setPlan(d); setDraft(draftFromCard(d.rateCard, d.maxGuests || 12)); setLoadError('') })
    .catch(e => setLoadError(e?.message || 'Could not load the rates'))
  useEffect(() => { load() }, [])

  // ── base rates ───────────────────────────────────────────────
  const filled = draft.filter(r => String(r.value).trim() !== '').map(r => ({ guests: r.guests, tariff: r.value }))
  const cardCheck = validateRateCardRows(filled, plan?.maxGuests || 12)
  const cardDirty = !!plan && JSON.stringify(filled.map(r => [r.guests, Number(r.tariff)])) !== JSON.stringify(plan.rateCard.map(r => [r.guests, r.tariff]))
  const cheaperAt = cardCheck.ok ? cardCheck.rows.find((r, i, a) => i > 0 && r.tariff < a[i - 1].tariff) : null

  const saveCard = async () => {
    if (!cardCheck.ok) { showToast(cardCheck.error, 'error'); return }
    setSavingCard(true)
    try {
      await api.saveRateCard({ villaId, rows: cardCheck.rows })
      showToast('Base rates saved ✓')
      await load()
    } catch (e) { showToast(e?.message || 'Could not save the rates', 'error') }
    finally { setSavingCard(false) }
  }

  // ── seasons ──────────────────────────────────────────────────
  const blankForm = (over = {}) => ({ id: null, name: '', startDate: '', endDate: '', yearly: true, mode: 'percent', upliftPct: '', cardDraft: {}, minNights: '', notes: '', active: true, ...over })
  const openAdd = (over) => { setForm(blankForm(over)); setFormError('') }
  const openEdit = (s) => {
    setForm({
      id: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate, yearly: s.yearly, mode: s.mode,
      upliftPct: s.mode === 'percent' ? String(s.upliftPct) : '',
      cardDraft: Object.fromEntries((s.card || []).map(r => [r.guests, String(r.tariff)])),
      minNights: s.minNights == null ? '' : String(s.minNights), notes: s.notes || '', active: s.active,
    })
    setFormError('')
  }
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // the base rate with the typed percentage on it, for the preview and for pre-filling "own prices"
  const pct = Number(form?.upliftPct)
  const seasonRow = (base) => (Number.isFinite(pct) && String(form?.upliftPct).trim() !== '' ? Math.round(base * (1 + pct / 100)) : base)
  const switchMode = (mode) => {
    setForm(f => {
      if (mode === 'card' && !Object.keys(f.cardDraft).length && plan) {
        return { ...f, mode, cardDraft: Object.fromEntries(plan.rateCard.map(r => [r.guests, String(seasonRow(r.tariff))])) }
      }
      return { ...f, mode }
    })
  }

  const seasonPayload = (f) => ({
    villaId, seasonId: f.id || undefined, name: f.name, startDate: f.startDate, endDate: f.endDate, yearly: f.yearly, mode: f.mode,
    upliftPct: f.upliftPct, minNights: f.minNights, notes: f.notes, active: f.active,
    card: f.mode === 'card' ? Object.entries(f.cardDraft).filter(([, v]) => String(v).trim() !== '').map(([g, v]) => ({ guests: Number(g), tariff: v })) : undefined,
  })

  const saveSeason = async () => {
    const body = seasonPayload(form)
    const check = validateSeason(body, plan?.maxGuests || 12)
    if (!check.ok) { setFormError(check.error); return }
    setSavingSeason(true); setFormError('')
    try {
      await api.saveRateSeason(body)
      showToast(form.id ? 'Season updated ✓' : 'Season added ✓')
      setForm(null)
      await load()
    } catch (e) { setFormError(e?.message || 'Could not save the season') }
    finally { setSavingSeason(false) }
  }

  const toggleActive = async (s) => {
    try {
      await api.saveRateSeason({ villaId, seasonId: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate, yearly: s.yearly, mode: s.mode, upliftPct: s.upliftPct, card: s.card || undefined, minNights: s.minNights == null ? '' : s.minNights, notes: s.notes, active: !s.active })
      showToast(s.active ? `${s.name} switched off ✓` : `${s.name} switched on ✓`)
      await load()
    } catch (e) { showToast(e?.message || 'Could not change the season', 'error') }
  }

  const removeSeason = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? Quotes will go back to the base rates for those dates.`)) return
    try {
      await api.deleteRateSeason({ seasonId: s.id })
      showToast('Season deleted ✓')
      await load()
    } catch (e) { showToast(e?.message || 'Could not delete the season', 'error') }
  }

  // ── try it ───────────────────────────────────────────────────
  const est = useMemo(() => plan ? estimateStay({
    rateCard: plan.rateCard, seasons: plan.seasons, adults: tryIn.adults, children: tryIn.children, checkIn: tryIn.checkIn, checkOut: tryIn.checkOut,
    overflowPerGuest: plan.overflowPerGuest, overflowMax: plan.overflowMax,
  }) : null, [plan, tryIn])

  const today = localTodayStr()
  const christmasYear = Number(today.slice(0, 4))
  const hasChristmas = !!plan && plan.seasons.some(s => /christmas|new year/i.test(s.name))
  const seasonsReady = !plan || plan.seasonsReady

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={goBack}>‹</button>
        <div><div className="topbar-title">Rates &amp; seasons</div><div className="topbar-sub">DWARKA</div></div>
      </div>

      <div className="screen-body">
        {loadError && (
          <div className="card" style={{ color: '#EF4444', fontSize: '0.82rem' }}>{loadError}</div>
        )}
        {!plan && !loadError && <div style={{ textAlign: 'center', color: '#5C7080', padding: '24px', fontSize: '0.82rem' }}>Loading…</div>}

        {plan && (
          <>
            <div style={{ ...dim, margin: '2px 2px 10px', lineHeight: 1.5 }}>
              These prices feed New enquiry, Enquiry detail and your agent quote links. What Airbnb, Booking.com and Agoda charge is set on
              those platforms.
            </div>

            {/* ── BASE RATES ─────────────────────────────── */}
            <div className="card-section-label">BASE RATES · PER NIGHT</div>
            <div className="card">
              <div style={{ ...dim, marginBottom: '10px', lineHeight: 1.5 }}>
                By party size (adults and children; infants are free). Above {plan.maxGuests} guests each extra guest adds {rupees(plan.overflowPerGuest)} a
                night for a floor bed; {plan.overflowMax} extra is the most we recommend.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                {draft.map(r => (
                  <label key={r.guests} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                    <span style={{ width: '64px', color: 'var(--text-dim)' }}>{r.guests} guest{r.guests === 1 ? '' : 's'}</span>
                    <input className="field-input" inputMode="numeric" aria-label={`Rate for ${r.guests} guests`} style={{ flex: 1, minWidth: 0, padding: '7px 9px' }}
                      value={r.value} placeholder="₹"
                      onChange={e => setDraft(d => d.map(x => (x.guests === r.guests ? { ...x, value: e.target.value.replace(/[^\d.]/g, '') } : x)))} />
                  </label>
                ))}
              </div>
              {cheaperAt && (
                <div style={{ color: '#F59E0B', fontSize: '0.74rem', marginTop: '10px' }}>
                  ⚠️ Check: {cheaperAt.guests} guests costs less than {cheaperAt.guests - 1}.
                </div>
              )}
              {!cardCheck.ok && filled.length > 0 && <div style={{ color: '#EF4444', fontSize: '0.74rem', marginTop: '10px' }}>{cardCheck.error}</div>}
              <button className="btn btn-gold" style={{ marginTop: '12px' }} onClick={saveCard} disabled={!cardDirty || !cardCheck.ok || savingCard}>
                {savingCard ? 'Saving...' : 'Save base rates'}
              </button>
            </div>

            {/* ── BUSY SEASONS ───────────────────────────── */}
            <div className="card-section-label" style={{ marginTop: '18px' }}>BUSY SEASONS</div>
            {!seasonsReady && (
              <div className="card" style={{ color: '#F59E0B', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Seasons cannot be saved yet: a one-time database setup is still waiting to be done. Base rates above work as usual.
              </div>
            )}
            {seasonsReady && plan.seasons.length === 0 && !form && (
              <div style={{ textAlign: 'center', padding: '18px', ...dim, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', marginBottom: '10px', lineHeight: 1.5 }}>
                No busy seasons yet. Add one, and every quote for those nights uses its prices; nights outside it keep the base rates.
              </div>
            )}

            {seasonsReady && plan.seasons.map(s => (
              <div key={s.id} className="card" style={{ opacity: s.active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{s.name}</div>
                    <div style={dim}>{seasonDatesLabel(s)}</div>
                  </div>
                  <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: '10px', fontSize: '0.74rem', fontWeight: 700,
                    background: s.active ? 'rgba(200,144,58,0.15)' : 'rgba(92,112,128,0.18)', color: s.active ? '#C8903A' : '#9AA5B4' }}>
                    {s.active ? seasonPriceLabel(s) : 'OFF'}
                  </span>
                </div>
                {(s.minNights || s.notes) && (
                  <div style={{ ...dim, marginTop: '6px', lineHeight: 1.5 }}>
                    {s.minNights ? `Minimum ${s.minNights} nights. ` : ''}{s.notes}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button style={smallBtn} onClick={() => openEdit(s)}>Edit</button>
                  <button style={smallBtn} onClick={() => toggleActive(s)}>{s.active ? 'Switch off' : 'Switch on'}</button>
                  <button style={{ ...smallBtn, color: '#EF4444' }} onClick={() => removeSeason(s)}>Delete</button>
                </div>
              </div>
            ))}

            {seasonsReady && !form && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <button className="btn btn-gold" style={{ flex: '1 1 auto' }} onClick={() => openAdd()}>＋ Add a season</button>
                {!hasChristmas && (
                  <button style={{ ...smallBtn, flex: '1 1 auto', padding: '10px 12px' }}
                    onClick={() => openAdd({ name: 'Christmas / New Year', startDate: `${christmasYear}-12-20`, endDate: `${christmasYear + 1}-01-05`, yearly: true })}>
                    ＋ Christmas / New Year (20 Dec → 5 Jan)
                  </button>
                )}
              </div>
            )}

            {seasonsReady && form && (
              <div className="card" style={{ border: '1px solid rgba(200,144,58,0.4)' }}>
                <div style={{ fontWeight: 700, marginBottom: '10px' }}>{form.id ? 'Edit season' : 'New season'}</div>

                <div className="field">
                  <label className="field-label" htmlFor="season-name">Name</label>
                  <input id="season-name" className="field-input" value={form.name} placeholder="Christmas / New Year" onChange={e => setF('name', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field-label" htmlFor="season-start">First night</label>
                    <input id="season-start" type="date" className="field-input" value={form.startDate} onChange={e => setF('startDate', e.target.value)} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field-label" htmlFor="season-end">Last night</label>
                    <input id="season-end" type="date" className="field-input" value={form.endDate} onChange={e => setF('endDate', e.target.value)} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', marginBottom: '12px', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={form.yearly} onChange={e => setF('yearly', e.target.checked)} style={{ marginTop: '3px' }} />
                  <span>Repeats every year <span style={dim}>(the year is ignored; for a festival whose dates move, leave this off and add it each year)</span></span>
                </label>

                <div className="field-label" style={{ marginBottom: '6px' }}>Price in this season</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  {[['percent', 'A percentage on the base rates'], ['card', 'Prices of their own']].map(([m, label]) => (
                    <button key={m} type="button" onClick={() => switchMode(m)} aria-pressed={form.mode === m}
                      style={{ ...smallBtn, flex: 1, padding: '9px 8px', background: form.mode === m ? 'rgba(200,144,58,0.18)' : 'transparent', borderColor: form.mode === m ? '#C8903A' : 'var(--border-dim)', fontWeight: form.mode === m ? 700 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>

                {form.mode === 'percent' ? (
                  <>
                    <div className="field">
                      <label className="field-label" htmlFor="season-pct">Change on the base rate (%) <span style={dim}>+30 = 30% more, −20 = a low season</span></label>
                      <input id="season-pct" className="field-input" inputMode="decimal" value={form.upliftPct} placeholder="+30"
                        onChange={e => setF('upliftPct', e.target.value.replace(/[^\d.+-]/g, ''))} />
                    </div>
                    <div style={{ ...dim, marginBottom: '4px' }}>Prices in this season (floor-bed guests above {plan.maxGuests} stay at {rupees(plan.overflowPerGuest)} each):</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 14px', fontSize: '0.78rem', marginBottom: '10px' }}>
                      {plan.rateCard.map(r => (
                        <div key={r.guests} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-dim)' }}>{r.guests} guest{r.guests === 1 ? '' : 's'}</span>
                          <span><span style={{ color: 'var(--text-dim)' }}>{rupees(r.tariff)} → </span><b>{rupees(seasonRow(r.tariff))}</b></span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ ...dim, marginBottom: '6px', lineHeight: 1.5 }}>Filled in from the base rates; change what you need. Floor-bed guests above {plan.maxGuests} are added at {rupees(plan.overflowPerGuest)} each.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: '10px' }}>
                      {Array.from({ length: plan.maxGuests }, (_, i) => i + 1).map(g => (
                        <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                          <span style={{ width: '64px', color: 'var(--text-dim)' }}>{g} guest{g === 1 ? '' : 's'}</span>
                          <input className="field-input" inputMode="numeric" aria-label={`Season rate for ${g} guests`} style={{ flex: 1, minWidth: 0, padding: '7px 9px' }}
                            value={form.cardDraft[g] ?? ''} placeholder="₹"
                            onChange={e => setForm(f => ({ ...f, cardDraft: { ...f.cardDraft, [g]: e.target.value.replace(/[^\d.]/g, '') } }))} />
                        </label>
                      ))}
                    </div>
                  </>
                )}

                <div className="field">
                  <label className="field-label" htmlFor="season-min">Minimum stay in this season (nights, optional)</label>
                  <input id="season-min" className="field-input" inputMode="numeric" value={form.minNights} placeholder="3"
                    onChange={e => setF('minNights', e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="season-notes">Note (only you see it)</label>
                  <input id="season-notes" className="field-input" value={form.notes} onChange={e => setF('notes', e.target.value)} />
                </div>

                {formError && <div style={{ color: '#EF4444', fontSize: '0.78rem', marginBottom: '8px' }}>{formError}</div>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-gold" style={{ flex: 1 }} onClick={saveSeason} disabled={savingSeason}>{savingSeason ? 'Saving...' : 'Save season'}</button>
                  <button style={{ ...smallBtn, padding: '10px 14px' }} onClick={() => { setForm(null); setFormError('') }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ ...dim, margin: '6px 2px 0', lineHeight: 1.5 }}>
              A stay that runs into a season pays the season's price for those nights only. If two seasons cover a night, one you set for a single
              year beats one that repeats every year; otherwise the higher price applies.
            </div>

            {/* ── TRY IT ─────────────────────────────────── */}
            <div className="card-section-label" style={{ marginTop: '18px' }}>TRY IT</div>
            <div className="card">
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="try-in">Check-in</label>
                  <input id="try-in" type="date" className="field-input" value={tryIn.checkIn} onChange={e => setTryIn(t => ({ ...t, checkIn: e.target.value }))} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="try-out">Check-out</label>
                  <input id="try-out" type="date" className="field-input" value={tryIn.checkOut} onChange={e => setTryIn(t => ({ ...t, checkOut: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="try-adults">Adults</label>
                  <input id="try-adults" className="field-input" inputMode="numeric" value={tryIn.adults} onChange={e => setTryIn(t => ({ ...t, adults: e.target.value.replace(/\D/g, '') }))} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="try-children">Children</label>
                  <input id="try-children" className="field-input" inputMode="numeric" value={tryIn.children} onChange={e => setTryIn(t => ({ ...t, children: e.target.value.replace(/\D/g, '') }))} />
                </div>
              </div>
              {est && est.nights > 0 ? (
                <div data-testid="try-result" style={{ fontSize: '0.84rem', lineHeight: 1.6 }}>
                  <div><b style={{ fontSize: '1.05rem' }}>{rupees(est.total)}</b> for {est.nights} night{est.nights === 1 ? '' : 's'} <span style={dim}>(about {rupees(est.tariffPerNight)} a night)</span></div>
                  <div style={dim}>{describeEstimate(est)}</div>
                  {est.minNightsNotes.map((n, i) => <div key={i} style={{ color: '#F59E0B', fontSize: '0.76rem', marginTop: '4px' }}>⚠️ {n}</div>)}
                </div>
              ) : (
                <div style={dim}>Pick dates to see what a stay would cost, night by night.</div>
              )}
            </div>
          </>
        )}
      </div>
      {toast && <div className={`toast ${toast.t}`}>{toast.msg}</div>}
    </div>
  )
}
