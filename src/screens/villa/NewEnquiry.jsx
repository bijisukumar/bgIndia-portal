import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { SOURCES, PURPOSES, STATUS_META } from './EnquiryTracker'
import { parseLocalDate, fmtDate } from '../../utils/dates'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import {
  getTariffEstimate, FALLBACK_RATE_CARDS, DISCOUNT_CATEGORIES, getDefaultDiscountPct,
  OVERFLOW_PER_GUEST_PER_NIGHT, OVERFLOW_MAX_RECOMMENDED, RATE_CARD_MAX_GUESTS,
} from '../../utils/villaPricing'

function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}` }

export default function NewEnquiry() {
  const navigate = useNavigate()
  const { enquiryId } = useParams()   // present when editing
  const isEdit = !!enquiryId

  const [form, setForm] = useState({
    guestName: '', phone: '', email: '', source: 'website',
    checkInDate: '', checkOutDate: '', adults: 2, children: 0, infants: 0, purpose: 'Vacation', purposeOther: '',
    quoteAmount: '', repeatDiscountPct: 0,
    discountCategory: '', discountPct: 0, discountAmountInput: '',
    status: 'new', notes: '',
  })
  const [rateCard, setRateCard] = useState(FALLBACK_RATE_CARDS.dwarka)
  const [pricingNote, setPricingNote] = useState(null)
  const [match, setMatch] = useState(null)       // result of findGuestMatch
  const [matchChecked, setMatchChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const debounceRef = useRef(null)

  // Name-based guest search (type-ahead), so an existing guest can be picked
  // instead of retyping phone/email by hand
  const [nameResults, setNameResults] = useState([])
  const [nameSearching, setNameSearching] = useState(false)
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false)
  const nameDebounceRef = useRef(null)
  const selectedNameRef = useRef('')   // last name picked from the dropdown, to avoid re-searching it

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  // Load the villa's rate card once on mount (falls back to the hardcoded
  // table if the fetch fails, so the Get Pricing button still works offline-ish)
  useEffect(() => {
    api.getRateCard(DEFAULT_VILLA_ID).then(d => {
      if (d?.rateCard?.length) setRateCard(d.rateCard)
    }).catch(() => {})
  }, [])

  // Load existing enquiry if editing
  useEffect(() => {
    if (!isEdit) return
    api.getEnquiryDetail(enquiryId).then(d => {
      const e = d?.enquiry
      if (!e) return
      setForm({
        guestName: e.guest_name || '', phone: e.phone || '', email: e.email || '',
        source: e.source || 'website', checkInDate: e.checkin_date || '', checkOutDate: e.checkout_date || '',
        adults: e.adults || e.guests_count || 1, children: e.children || 0, infants: e.infants || 0,
        purpose: e.purpose || 'Vacation', purposeOther: e.purpose_other || '',
        quoteAmount: e.quote_amount || '', repeatDiscountPct: e.repeat_discount_pct || 0,
        discountCategory: e.discount_category || '', discountPct: e.discount_pct || 0,
        discountAmountInput: e.discount_category === 'custom_amount' ? (e.discount_amount || '') : '',
        status: e.status || 'new', notes: e.notes || '',
      })
    }).catch(() => {})
  }, [isEdit, enquiryId])

  // Live repeat-guest lookup, debounced, whenever phone or email looks complete
  useEffect(() => {
    if (isEdit) return  // don't re-trigger matching while editing an existing enquiry
    const phoneOk = form.phone.replace(/\D/g, '').length >= 10
    const emailOk = /\S+@\S+\.\S+/.test(form.email)
    if (!phoneOk && !emailOk) { setMatch(null); setMatchChecked(false); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      api.findGuestMatch(form.phone, form.email).then(d => {
        setMatch(d || null)
        setMatchChecked(true)
        if (d?.guest) {
          // Pre-fill a sensible repeat-guest discount if none entered yet
          setForm(f => f.repeatDiscountPct ? f : { ...f, repeatDiscountPct: 10 })
        }
      }).catch(() => setMatchChecked(true))
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [form.phone, form.email, isEdit])

  // Live guest-name search, debounced — lets the owner pick an existing guest
  // instead of typing phone/email by hand
  useEffect(() => {
    if (isEdit) return
    const q = form.guestName.trim()
    if (q.length < 2 || q === selectedNameRef.current) { setNameResults([]); setNameDropdownOpen(false); return }

    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)
    setNameSearching(true)
    nameDebounceRef.current = setTimeout(() => {
      api.searchGuestsByName(q).then(results => {
        setNameResults(results || [])
        setNameDropdownOpen(true)
      }).catch(() => {}).finally(() => setNameSearching(false))
    }, 300)
    return () => { if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current) }
  }, [form.guestName, isEdit])

  const handleSelectGuest = (g) => {
    selectedNameRef.current = g.name
    setForm(f => ({ ...f, guestName: g.name, phone: g.phone || f.phone, email: g.email || f.email }))
    setNameDropdownOpen(false)
    setNameResults([])
  }

  const nights = form.checkInDate && form.checkOutDate
    ? Math.max(0, Math.round((parseLocalDate(form.checkOutDate) - parseLocalDate(form.checkInDate)) / 86400000))
    : 0

  // Availability label — auto-checks as soon as both dates are valid.
  // avail: undefined = idle, 'loading', or { available, conflicts, nearby }
  const [avail, setAvail] = useState(undefined)
  useEffect(() => {
    if (!form.checkInDate || !form.checkOutDate || form.checkOutDate <= form.checkInDate) { setAvail(undefined); return }
    let stale = false
    setAvail('loading')
    api.checkAvailability({ villaId: DEFAULT_VILLA_ID, checkIn: form.checkInDate, checkOut: form.checkOutDate })
      .then(d => { if (!stale) setAvail(d || undefined) })
      .catch(() => { if (!stale) setAvail(undefined) })
    return () => { stale = true }
  }, [form.checkInDate, form.checkOutDate])

  const fmtShort = d => { try { return fmtDate(d, { day: 'numeric', month: 'short' }) } catch (_) { return d } }
  const turnoverTag = r => (r.checkout_date === form.checkInDate || r.checkin_date === form.checkOutDate) ? ' (same-day turnover)' : ''
  const adultsNum = parseInt(form.adults, 10) || 0
  const childrenNum = parseInt(form.children, 10) || 0
  const infantsNum = parseInt(form.infants, 10) || 0
  const totalGuests = adultsNum + childrenNum + infantsNum

  const quote = parseFloat(form.quoteAmount) || 0
  // Discount category (new system) and legacy repeat-guest % are mutually exclusive —
  // whichever the owner has set on this enquiry is what's applied to the quote.
  // "Custom Amount" is a third mode: the owner enters a rupee amount directly and we
  // back-compute the equivalent % (rounded to 2dp for storage) so it flows through the
  // same discountPct/discountCategory fields every other category already uses.
  const isCustomDiscount = form.discountCategory === 'custom_amount'
  const customAmount = parseFloat(form.discountAmountInput) || 0
  const discountPctRaw = isCustomDiscount
    ? (quote > 0 ? (customAmount / quote) * 100 : 0)
    : form.discountCategory
      ? (parseFloat(form.discountPct) || 0)
      : (parseFloat(form.repeatDiscountPct) || 0)
  const discountPct = isCustomDiscount ? Math.round(discountPctRaw * 100) / 100 : discountPctRaw
  // Use the exact typed amount for the live preview (not the rounded-%-back-to-amount
  // round trip) so what the owner sees while composing matches what they typed.
  const discountAmount = isCustomDiscount ? customAmount : Math.round(quote * discountPct) / 100
  const finalOffer = quote - discountAmount

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGetPricing = () => {
    if (totalGuests === 0) { showToast('Add guest counts first', 'error'); return }
    if (nights === 0) { showToast('Add check-in and check-out dates first', 'error'); return }
    const estimate = getTariffEstimate(rateCard, { adults: adultsNum, children: childrenNum, nights })
    set('quoteAmount', String(estimate.total))
    if (estimate.overflowGuests > 0) {
      const msg = estimate.withinRecommended
        ? `${estimate.overflowGuests} extra guest${estimate.overflowGuests === 1 ? '' : 's'} beyond ${RATE_CARD_MAX_GUESTS} added at ₹${OVERFLOW_PER_GUEST_PER_NIGHT}/guest/night (floor beds)`
        : `${estimate.overflowGuests} extra guests beyond ${RATE_CARD_MAX_GUESTS} — exceeds the recommended max of ${OVERFLOW_MAX_RECOMMENDED} extra guests on floor beds`
      setPricingNote({ msg, level: estimate.withinRecommended ? 'info' : 'warn' })
    } else {
      setPricingNote(null)
    }
    showToast(`Estimated ₹${estimate.tariffPerNight.toLocaleString('en-IN')}/night × ${nights} night${nights === 1 ? '' : 's'}`)
  }

  const handleDiscountCategoryChange = (categoryId) => {
    setForm(f => ({
      ...f,
      discountCategory: categoryId,
      // Pre-fill the default % for the chosen category, but only if the field
      // is still at 0 / hasn't been hand-edited yet for this category.
      discountPct: categoryId ? getDefaultDiscountPct(categoryId) : 0,
      discountAmountInput: '',
    }))
  }

  const handleSave = async () => {
    if (!form.guestName.trim()) { showToast('Guest name required', 'error'); return }
    setSaving(true)
    try {
      const result = await api.saveEnquiry({
        enquiryId: isEdit ? enquiryId : undefined,
        villaId: DEFAULT_VILLA_ID,
        guestId: match?.guest?.guest_id,
        guestName: form.guestName, phone: form.phone, email: form.email,
        source: form.source, checkInDate: form.checkInDate, checkOutDate: form.checkOutDate,
        adults: adultsNum, children: childrenNum, infants: infantsNum, guestsCount: totalGuests,
        purpose: form.purpose, purposeOther: form.purpose === 'Other' ? form.purposeOther.trim() : null,
        quoteAmount: quote, repeatDiscountPct: form.discountCategory ? 0 : discountPct,
        discountCategory: form.discountCategory || null, discountPct: form.discountCategory ? discountPct : 0,
        status: form.status, notes: form.notes,
      })
      showToast(isEdit ? 'Enquiry updated ✓' : 'Enquiry created ✓')
      setTimeout(() => navigate(`/owner/villa/enquiries/${result.enquiryId}`), 600)
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">{isEdit ? 'Edit Enquiry' : 'New Enquiry'}</div>
          <div className="topbar-sub">DWARKA · GUEST ENQUIRY</div>
        </div>
      </div>

      <div className="screen-body">
        <div className="card-section-label">GUEST INFORMATION</div>
        <div className="card">
          <div className="field" style={{ position: 'relative' }}>
            <div className="field-label">Full name</div>
            <input
              className="field-input" value={form.guestName}
              onChange={e => set('guestName', e.target.value)}
              onFocus={() => { if (nameResults.length) setNameDropdownOpen(true) }}
              onBlur={() => setTimeout(() => setNameDropdownOpen(false), 150)}
              placeholder="Type a name to search existing guests…" autoComplete="off"
            />
            {nameDropdownOpen && (
              <div style={{
                position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, marginTop: '4px',
                background: 'var(--dark-card)', border: '1px solid var(--border-dim)', borderRadius: '8px',
                overflow: 'hidden', maxHeight: '220px', overflowY: 'auto',
              }}>
                {nameSearching && (
                  <div style={{ padding: '8px 10px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>Searching…</div>
                )}
                {!nameSearching && nameResults.map(g => (
                  <div
                    key={g.guest_id}
                    onMouseDown={() => handleSelectGuest(g)}
                    style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border-dim)', fontSize: '0.82rem' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,144,58,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      {g.phone || g.email || '—'} · {g.total_stays || 0} past stay{g.total_stays !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
                {!nameSearching && nameResults.length === 0 && (
                  <div style={{ padding: '8px 10px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>No matching guests found</div>
                )}
              </div>
            )}
          </div>
          <div className="field">
            <div className="field-label">Mobile / WhatsApp</div>
            <input className="field-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="field-label">Email</div>
            <input className="field-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="guest@example.com" />
          </div>
        </div>

        {matchChecked && match?.guest && (
          <div className="card" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', marginTop: '-2px' }}>
            <div style={{ color: '#8B5CF6', fontWeight: '700', fontSize: '0.85rem', marginBottom: '6px' }}>
              🟣 Repeat Guest – Stayed {match.guest.total_stays} time{match.guest.total_stays === 1 ? '' : 's'}
            </div>
            <div style={{ color: '#5C7080', fontSize: '0.75rem', lineHeight: 1.6 }}>
              Total revenue: <strong style={{ color: 'var(--text)' }}>{fmt(match.guest.total_revenue)}</strong><br />
              {match.pastStays?.[0] && <>Last stay: {match.pastStays[0].checkin_date} ({match.pastStays[0].source})</>}
            </div>
          </div>
        )}
        {matchChecked && !match?.guest && (form.phone || form.email) && (
          <div style={{ color: '#5C7080', fontSize: '0.72rem', padding: '4px 4px 0' }}>No matching guest history found — first-time enquiry.</div>
        )}

        <div className="card-section-label" style={{ marginTop: '14px' }}>STAY REQUEST</div>
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="field">
              <div className="field-label">Check-in</div>
              <input type="date" className="field-input" value={form.checkInDate} onChange={e => set('checkInDate', e.target.value)} />
            </div>
            <div className="field">
              <div className="field-label">Check-out</div>
              <input type="date" className="field-input" value={form.checkOutDate} onChange={e => set('checkOutDate', e.target.value)} />
            </div>
          </div>
          {nights > 0 && <div style={{ color: '#5C7080', fontSize: '0.72rem', margin: '-6px 0 10px' }}>{nights} night{nights === 1 ? '' : 's'}</div>}
          {avail === 'loading' && (
            <div style={{ color: '#5C7080', fontSize: '0.72rem', margin: '-2px 0 10px' }}>Checking availability…</div>
          )}
          {avail && avail !== 'loading' && (
            <div style={{ margin: '-2px 0 10px' }}>
              {avail.available ? (
                <div style={{ color: '#34A853', fontSize: '0.76rem', fontWeight: 600 }}>
                  ✓ Villa available {fmtShort(form.checkInDate)} → {fmtShort(form.checkOutDate)}
                </div>
              ) : (
                <div style={{ color: '#E06C5A', fontSize: '0.76rem', fontWeight: 600 }}>
                  ✕ Not available — {avail.conflicts.map(c =>
                    `${c.guest_name} ${fmtShort(c.checkin_date)}→${fmtShort(c.checkout_date)}`).join(' · ')}
                </div>
              )}
              {avail.nearby && avail.nearby.length > 0 && (
                <div style={{ color: '#5C7080', fontSize: '0.7rem', marginTop: '3px', lineHeight: 1.5 }}>
                  Around these dates: {avail.nearby.map(r =>
                    `${r.guest_name} ${fmtShort(r.checkin_date)}→${fmtShort(r.checkout_date)}${turnoverTag(r)}`).join(' · ')}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="field">
              <div className="field-label">Adults</div>
              <input type="number" min="0" className="field-input" value={form.adults} onChange={e => set('adults', parseInt(e.target.value) || 0)} />
            </div>
            <div className="field">
              <div className="field-label">Children (1–12y)</div>
              <input type="number" min="0" className="field-input" value={form.children} onChange={e => set('children', parseInt(e.target.value) || 0)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="field-label">Infants (≤1y)</div>
              <input type="number" min="0" className="field-input" value={form.infants} onChange={e => set('infants', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div style={{ color: '#5C7080', fontSize: '0.72rem', margin: '6px 0 10px' }}>
            Total guests: <strong style={{ color: 'var(--text)' }}>{totalGuests}</strong>
            {infantsNum > 0 && <span> ({adultsNum + childrenNum} billable + {infantsNum} infant{infantsNum === 1 ? '' : 's'} free)</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="field-label">Purpose</div>
              <select className="field-input" value={form.purpose} onChange={e => set('purpose', e.target.value)}>
                {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {form.purpose === 'Other' && (
              <div className="field" style={{ marginBottom: 0, marginTop: '10px' }}>
                <div className="field-label">Please specify</div>
                <input className="field-input" value={form.purposeOther}
                  onChange={e => set('purposeOther', e.target.value)}
                  placeholder="e.g. Photoshoot, Corporate offsite…" />
              </div>
            )}
          </div>
          <div className="field" style={{ marginTop: '10px', marginBottom: 0 }}>
            <div className="field-label">Source</div>
            <select className="field-input" value={form.source} onChange={e => set('source', e.target.value)}>
              {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="card-section-label" style={{ marginTop: '14px' }}>PRICING</div>
        <div className="card">
          <div className="field">
            <div className="field-label">Quote amount (₹)</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="number" className="field-input" value={form.quoteAmount} onChange={e => { set('quoteAmount', e.target.value); setPricingNote(null) }} placeholder="0" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" className="btn" onClick={handleGetPricing} style={{ width: 'auto', flex: '0 0 auto', whiteSpace: 'nowrap', padding: '0 14px' }}>
                Get pricing
              </button>
            </div>
            <div style={{ color: '#5C7080', fontSize: '0.7rem', marginTop: '4px' }}>
              Calculates from adults + children over {nights || '?'} night{nights === 1 ? '' : 's'} using the Dwarka rate card
            </div>
          </div>

          {pricingNote && (
            <div style={{
              fontSize: '0.72rem', padding: '8px 10px', borderRadius: '8px', marginBottom: '10px',
              background: pricingNote.level === 'warn' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
              border: `1px solid ${pricingNote.level === 'warn' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
              color: pricingNote.level === 'warn' ? '#EF4444' : '#3B82F6',
            }}>
              {pricingNote.level === 'warn' ? '⚠️ ' : 'ℹ️ '}{pricingNote.msg}
            </div>
          )}

          <div className="field">
            <div className="field-label">Discount type</div>
            <select className="field-input" value={form.discountCategory} onChange={e => handleDiscountCategoryChange(e.target.value)}>
              <option value="">None</option>
              {DISCOUNT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {isCustomDiscount ? (
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="field-label">Discount amount (₹)</div>
              <input type="number" min="0" className="field-input" value={form.discountAmountInput}
                onChange={e => set('discountAmountInput', e.target.value)} placeholder="0" />
              {quote > 0 && customAmount > 0 && (
                <div style={{ color: '#5C7080', fontSize: '0.72rem', marginTop: '4px' }}>
                  = {discountPct.toFixed(1)}% discount
                </div>
              )}
            </div>
          ) : form.discountCategory ? (
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="field-label">Discount %</div>
              <input type="number" min="0" max="100" className="field-input" value={form.discountPct} onChange={e => set('discountPct', e.target.value)} />
            </div>
          ) : (
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="field-label">Repeat guest discount %</div>
              <input type="number" min="0" max="100" className="field-input" value={form.repeatDiscountPct} onChange={e => set('repeatDiscountPct', e.target.value)} />
            </div>
          )}

          {quote > 0 && (
            <div className="net-box" style={{ marginTop: '10px' }}>
              <div className="net-row"><span className="net-label">Quote</span><span className="net-val">{fmt(quote)}</span></div>
              {discountAmount > 0 && <div className="net-row"><span className="net-label">Discount{form.discountCategory ? ` (${DISCOUNT_CATEGORIES.find(c => c.id === form.discountCategory)?.label}${isCustomDiscount ? ` · ${discountPct.toFixed(1)}%` : ''})` : ''}</span><span className="net-val">−{fmt(discountAmount)}</span></div>}
              <div className="net-divider" />
              <div className="net-row"><span style={{ fontWeight: 700 }}>Final offer</span><span className="net-val big">{fmt(finalOffer)}</span></div>
            </div>
          )}
        </div>

        <div className="card-section-label" style={{ marginTop: '14px' }}>STATUS & NOTES</div>
        <div className="card">
          <div className="field">
            <div className="field-label">Status</div>
            <select className="field-input" value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="field-label">Notes</div>
            <input className="field-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Quick notes…" />
          </div>
        </div>

        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save changes →' : 'Create enquiry →'}
        </button>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
