/**
 * GoDirectCard.jsx   (src/components/GoDirectCard.jsx)
 *
 * What it is: the "Go direct?" card on Complete booking. For a booking that came through a platform (Airbnb and the like) and has not arrived yet, it
 * puts the platform's side and a direct booking side by side so the owner can see, and show a guest, what going direct would be worth:
 *   - the platform side: what the guest paid, what the platform kept, what we receive (from the money already saved on the booking);
 *   - the direct side: it starts at the SAME price the guest paid the platform (the usual: the guest is not asked for more, and we keep the commission),
 *     or at our rate card for the same dates and party (busy seasons night by night); every figure on it can be typed over: the room price, the discount,
 *     each extra. The extras are the difference a guest comes direct for: an early check-in or late check-out (with the hour they asked for), breakfast,
 *     a floor bed, and guests beyond what the platform takes (it allows 12, the villa more);
 *   - who saves what, and the same WhatsApp quote the Enquiry screen sends ("Generate & copy" and "Send quote in WhatsApp").
 * It SAVES NOTHING and changes no booking: it only reads. The arithmetic is in src/utils/goDirect.js, the words of the quote in src/utils/enquiryQuote.js.
 * Used by: src/screens/villa/CompleteBooking.jsx, just above Channel & tariff, with key={stay_id} so a fresh booking starts a fresh card.
 *
 * WHAT CHANGED (newest first)
 *   2026-11-27  (later) Biji: "I should be able to update the numbers. I will mostly charge the same as Airbnb. The main difference is early check-in /
 *               check-out, which Airbnb does not offer. Airbnb allows only 12 guests, we can go up to 15." So: the direct side now starts at the
 *               platform's own price (two buttons, "Same as Airbnb" / "Rate card"), the room price is a box you can type over, a party bigger than the
 *               booking gets a one-tap "Additional Guests" line priced from the rate card (editable), and a price that is the same as the platform's
 *               reads "Guest pays the same" instead of "Guest saves ₹0".
 *   2026-11-27  New (Biji, looking at Sneha S's Airbnb booking: "build the comparison card first; we will send the quote like Enquiry does. This is
 *               usually when people want customization and are willing to come direct"). Customisation = the extras and their hours; the quote = the
 *               Enquiry quote, worded for a guest who already holds a booking.
 */
import { useState, useEffect, useMemo } from 'react'
import { api } from '../api'
import { CONFIG } from '../config'
import { DEFAULT_VILLA_ID } from '../utils/villaContext'
import { villaTimeDefaults } from '../utils/villaTimes'
import { getSeasonalEstimate, estimateNotes, FALLBACK_RATE_CARDS, EXTRA_ITEMS } from '../utils/villaPricing'
import { partnerSide, roomPrice, directSide, extraGuests, compare, flexShares, flexHints, startingLines, quoteFor } from '../utils/goDirect'
import { buildQuote, buildQuoteWaLink } from '../utils/enquiryQuote'

// Whole rupees on screen (the stored money keeps its paise): 2286.56 reads ₹2,287.
const rs = n => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
// The two extras that carry an hour: the Enquiry screen finds them by the same words in the label.
const isEarlyLabel = label => String(label || '').includes('Early Check-in')
const isLateLabel = label => String(label || '').includes('Late Check-out')
// A default amount for an extra is the one in the host's list (hosts/<id>/config.js pricing.extraItems), as on the Enquiry screen.
const defaultAmount = label => (EXTRA_ITEMS.find(x => x.label === label) || {}).amount || 0
// The extras line a bigger party adds ("Additional Guests (3)"). Any line that starts with "Additional Guest" counts as that line: the host's own
// list has an "Additional Guest" item, and a card that offered a second line for the same guests would double-charge them.
const EXTRA_GUESTS_PREFIX = 'Additional Guest'
const extraGuestsLabel = more => `Additional Guests (${more})`
// How a saving reads: positive, negative or nothing at all ("saves ₹0" for a guest who pays the same would read as a miss).
const guestPhrase = g => g > 0 ? `saves ${rs(g)}` : g < 0 ? `pays ${rs(-g)} more` : 'pays the same'
const keepPhrase = k => k > 0 ? `keep ${rs(k)} more` : k < 0 ? `keep ${rs(-k)} less` : 'keep the same'

export default function GoDirectCard({ stay }) {
  const s = stay || {}
  const villaId = s.villa_id || DEFAULT_VILLA_ID

  // ── THE PLATFORM SIDE: plain arithmetic on the money saved on the booking ──
  const partner = partnerSide(s, CONFIG)
  const canMatchPlatform = partner.hasMoney && partner.room > 0   // "same as the platform" needs its price saved on the booking

  // ── WHAT THE OWNER CAN CHANGE ON THE CARD (none of it is saved) ──
  const [open, setOpen] = useState(false)                       // collapsed until asked for: the rate card is read only then
  const [rates, setRates] = useState(null)                      // { rateCard, seasons } once read
  const [ratesNote, setRatesNote] = useState('')                // said when the saved rate card could not be read
  const [adults, setAdults] = useState(String(parseInt(s.adults, 10) || 0))
  const [children, setChildren] = useState(String(parseInt(s.children, 10) || 0))
  const [discount, setDiscount] = useState('')                  // percent, blank = none
  const [basis, setBasis] = useState('same')                    // where the room price comes from: 'same' (the platform's), 'card' (rate card) or 'custom' (typed)
  const [roomInput, setRoomInput] = useState('')                // the typed room price, used when basis is 'custom'
  const [lines, setLines] = useState(() => startingLines(s))    // the extras of the direct quote, starting from those already on the booking
  const [toast, setToast] = useState('')

  // ── THE RATE CARD AND THE BUSY SEASONS: read once, the first time the card is opened ──
  // Same call the Enquiry screen makes. If it fails the standard card from the host's config is used, and the card says so.
  useEffect(() => {
    if (!open || rates) return
    let alive = true
    api.getRateCard(villaId).then(d => {
      if (!alive) return
      const rateCard = d && d.rateCard && d.rateCard.length ? d.rateCard : (FALLBACK_RATE_CARDS[villaId] || FALLBACK_RATE_CARDS.dwarka)
      setRates({ rateCard, seasons: Array.isArray(d && d.seasons) ? d.seasons : [] })
    }).catch(() => {
      if (!alive) return
      setRates({ rateCard: FALLBACK_RATE_CARDS[villaId] || FALLBACK_RATE_CARDS.dwarka, seasons: [] })
      setRatesNote('Your saved rate card could not be read just now, so this uses the standard card and no busy seasons. Check the Rates page before you quote.')
    })
    return () => { alive = false }
  }, [open])

  // ── THE RATE-CARD PRICE: for the party on the card, and for the party that was booked (the difference is what extra guests cost) ──
  const A = Math.max(0, parseInt(adults, 10) || 0)
  const C = Math.max(0, parseInt(children, 10) || 0)
  const bookedAdults = Math.max(0, parseInt(s.adults, 10) || 0)
  const bookedChildren = Math.max(0, parseInt(s.children, 10) || 0)
  const checkIn = String(s.checkin_date || '').slice(0, 10)
  const checkOut = String(s.checkout_date || '').slice(0, 10)
  const estimate = useMemo(() => rates ? getSeasonalEstimate(rates.rateCard, rates.seasons, { adults: A, children: C, checkIn, checkOut }) : null,
    [rates, A, C, checkIn, checkOut])
  const bookedEstimate = useMemo(() => rates ? getSeasonalEstimate(rates.rateCard, rates.seasons, { adults: bookedAdults, children: bookedChildren, checkIn, checkOut }) : null,
    [rates, bookedAdults, bookedChildren, checkIn, checkOut])

  // ── THE DIRECT SIDE: the room price from the chosen basis, then the discount and the extras ──
  const price = estimate ? roomPrice({ basis, partner, estimate, custom: roomInput }) : null
  const direct = estimate ? directSide({ estimate, roomTotal: price.total, discountPct: discount, lines }) : null
  const cmp = direct ? compare(partner, direct) : null
  const shares = direct ? flexShares(direct.perNight) : null
  // The note under the tiles: floor-bed guests above the card's top row, and (only when the price IS the rate card's) the busy seasons in play.
  const notes = estimate ? estimateNotes(price.basis === 'card' ? estimate : { ...estimate, seasonal: false }) : null

  // ── GUESTS BEYOND THE BOOKING: the platform takes 12, the villa more; the rate card prices the extra guests, one tap puts them on the quote ──
  const bookedGuests = bookedAdults + bookedChildren
  const more = extraGuests({ bookedGuests, nowGuests: A + C, estimateNow: estimate, estimateBooked: bookedEstimate })
  const guestsLineAt = lines.findIndex(l => String(l.label || '').startsWith(EXTRA_GUESTS_PREFIX))
  // Offered when the room price is the platform's (a rate-card or typed price already says what these guests cost), and not again once the line
  // is there for this many guests (a line whose amount was typed over stays as the owner set it).
  const showGuestsHint = !!price && price.basis === 'same' && more.more > 0 && more.amount > 0
    && (guestsLineAt < 0 || lines[guestsLineAt].label !== extraGuestsLabel(more.more))

  // ── THE QUOTE: the same builder the Enquiry screen uses, fed this booking's guest, dates and the direct price ──
  // Held back while the room price is 0 (a box being retyped, or left empty): a quote with no room price must not be sendable by accident.
  const quoteInput = direct && direct.total > 0 ? quoteFor({ stay: s, label: partner.label, villaId, adults: A, children: C, estimate, direct, lines, basis: price.basis }) : null
  const waLink = quoteInput ? buildQuoteWaLink(quoteInput) : null
  const copyQuote = () => {
    if (!quoteInput) return
    navigator.clipboard.writeText(buildQuote(quoteInput, true)).then(() => {
      setToast('Quote copied: paste it into WhatsApp')
      setTimeout(() => setToast(''), 3000)
    })
  }

  // ── THE EXTRAS: add one from the host's list, change it, take it away ──
  const addLine = (label, patch = {}) => setLines(prev => [...prev, { label, amount: defaultAmount(label), ...patch }])
  const changeLine = (i, patch) => setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l))
  const removeLine = i => setLines(prev => prev.filter((_, j) => j !== i))
  // What the guest has already asked for (an early or late time on the booking) and has not yet been put on the quote as an extra.
  const hints = flexHints(s, villaTimeDefaults()).filter(h => !lines.some(l => h.kind === 'early' ? isEarlyLabel(l.label) : isLateLabel(l.label)))

  // ── WHAT IS DRAWN ──
  const pctNote = partner.pct != null ? ` (${partner.pct}%)` : ''
  const guestsNow = A + C
  return (
    <>
      <div className="card-section-label">GO DIRECT?</div>
      <div className="card">

        {/* The one-line summary, always shown: a tap opens the comparison. */}
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          style={{ width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
              {partner.hasMoney
                ? <>{partner.label} keeps <strong style={{ color: '#E8A33D' }}>{rs(partner.partnerKeeps)}{pctNote}</strong> of this booking. See what a direct booking would be worth, and send the guest our quote.</>
                : <>Compare this {partner.label} booking with a direct one, and send the guest our quote.</>}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--gold)', whiteSpace: 'nowrap' }}>{open ? 'Hide ▴' : 'Compare ▾'}</span>
          </div>
        </button>

        {open && (
          <div style={{ marginTop: '12px' }}>

            {/* How many guests, and the discount to offer. The guest count starts as booked; a guest who wants to bring more is priced by changing it. */}
            <div style={st.threeCols}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Adults</label>
                <input className="field-input" type="number" min="0" value={adults} onChange={e => setAdults(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Children</label>
                <input className="field-input" type="number" min="0" value={children} onChange={e => setChildren(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Discount (%)</label>
                <input className="field-input gold" type="number" min="0" max="100" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
            </div>
            {ratesNote && <div style={{ ...st.small, color: '#E8A33D', marginTop: '8px' }}>{ratesNote}</div>}
            {!direct && <div style={{ ...st.small, marginTop: '10px' }}>Reading your rate card…</div>}

            {direct && (
              <>
                {/* The two sides next to each other. */}
                <div style={st.sides}>
                  <div style={st.side}>
                    <div style={st.sideTitle}>{partner.label} booking, as booked</div>
                    {partner.hasMoney ? (
                      <>
                        <Row label="Guest pays" value={rs(partner.guestPays)} />
                        <div style={st.sub}>
                          Stay {rs(partner.room)}{partner.guestFee > 0 ? ` + guest fee ${rs(partner.guestFee)}` : ''}{partner.extras > 0 ? ` + extras ${rs(partner.extras)}` : ''}
                        </div>
                        <Row label={`${partner.label} keeps${pctNote}`} value={`−${rs(partner.partnerKeeps)}`} color="#EF4444" />
                        <Row label="You receive" value={rs(partner.youReceive)} bold />
                        {partner.estimated && <div style={st.sub}>{partner.label}'s cut is worked out from its rate, not read from a statement.</div>}
                      </>
                    ) : (
                      <div style={st.small}>This booking's money has not been saved yet (see Channel & tariff below), so there is nothing to put beside the direct side.</div>
                    )}
                  </div>
                  <div style={{ ...st.side, border: '2px solid rgba(200,144,58,0.55)' }}>
                    <div style={st.sideTitle}>Direct booking</div>

                    {/* Where the room price comes from: the platform's own price (the usual), or the rate card. Typing in the box makes it your own figure. */}
                    <div style={st.basisRow} role="group" aria-label="Where the room price comes from">
                      {canMatchPlatform && (
                        <button type="button" aria-pressed={price.basis === 'same'} onClick={() => setBasis('same')}
                          style={{ ...st.pill, ...(price.basis === 'same' ? st.pillOn : null) }}>Same as {partner.label}</button>
                      )}
                      <button type="button" aria-pressed={price.basis === 'card'} onClick={() => setBasis('card')}
                        style={{ ...st.pill, ...(price.basis === 'card' ? st.pillOn : null) }}>Rate card</button>
                    </div>

                    {/* The room price: one box for the whole stay, typed over to charge something else. */}
                    <div style={st.roomRow}>
                      <span style={{ flex: '1 1 110px', color: 'var(--text-dim)' }}>{`Room, ${guestsNow} guest${guestsNow === 1 ? '' : 's'} × ${direct.nights} night${direct.nights === 1 ? '' : 's'}`}</span>
                      <input type="number" min="0" aria-label="Room price for the whole stay" placeholder="0"
                        value={price.basis === 'custom' ? roomInput : String(price.total)}
                        onChange={e => { setBasis('custom'); setRoomInput(e.target.value) }} style={st.amountInput} />
                    </div>
                    <div style={st.sub}>
                      {price.basis === 'same' && `Same as ${partner.label}: what the guest paid for the stay. Type over it to charge something else.`}
                      {price.basis === 'card' && `From your rate card for ${guestsNow} guest${guestsNow === 1 ? '' : 's'}${estimate.seasonal ? ', busy seasons night by night' : ''}.`}
                      {price.basis === 'custom' && `Your own figure. Tap ${canMatchPlatform ? `Same as ${partner.label} or ` : ''}Rate card to go back.`}
                    </div>

                    {direct.pct > 0 && <Row label={`Discount (${direct.pct}%)`} value={`−${rs(direct.discountAmount)}`} color="#34A853" />}
                    {lines.filter(l => parseFloat(l.amount) > 0).map((l, i) => <Row key={i} label={`+ ${l.label}`} value={rs(l.amount)} />)}
                    <Row label="Guest pays" value={rs(direct.guestPays)} />
                    <Row label="Platform fee" value="₹0" />
                    <Row label="You receive" value={rs(direct.youReceive)} bold />
                  </div>
                </div>

                {/* Who saves what. Negative is said plainly: a bigger party, a discount or extras can make direct cost the guest more or leave us less. */}
                {partner.hasMoney && cmp && (
                  <div style={st.threeCols}>
                    <div style={st.metric}>
                      <div style={st.small}>{Math.round(cmp.guestSaves) > 0 ? 'Guest saves' : Math.round(cmp.guestSaves) < 0 ? 'Guest pays more' : 'Guest pays the same'}</div>
                      <div style={{ ...st.metricNum, color: Math.round(cmp.guestSaves) > 0 ? '#34A853' : Math.round(cmp.guestSaves) < 0 ? '#EF4444' : 'var(--text)' }}>{rs(Math.abs(cmp.guestSaves))}</div>
                    </div>
                    <div style={st.metric}>
                      <div style={st.small}>{Math.round(cmp.youKeepMore) > 0 ? 'You keep more' : Math.round(cmp.youKeepMore) < 0 ? 'You keep less' : 'You keep the same'}</div>
                      <div style={{ ...st.metricNum, color: Math.round(cmp.youKeepMore) > 0 ? '#34A853' : Math.round(cmp.youKeepMore) < 0 ? '#EF4444' : 'var(--text)' }}>{rs(Math.abs(cmp.youKeepMore))}</div>
                    </div>
                  </div>
                )}
                {/* With extras in play (an early check-in the platform booking does not have), the room alone is the fair comparison: say it too. */}
                {partner.hasMoney && cmp && (direct.extrasTotal > 0 || partner.extras > 0) && (
                  <div style={{ ...st.small, marginTop: '8px' }}>
                    Room alone, before extras: the guest {guestPhrase(Math.round(cmp.roomOnly.guestSaves))} and you {keepPhrase(Math.round(cmp.roomOnly.youKeepMore))}.
                  </div>
                )}
                {notes && <div style={{ ...st.small, marginTop: '8px', color: notes.level === 'warn' ? '#E8A33D' : 'var(--text-dim)' }}>{notes.msg}</div>}

                {/* Customising: the extras a guest wants to come direct for, with the hours they ask for (the quote words them, as the Enquiry quote does). */}
                <div className="card-section-label" style={{ marginTop: '14px', marginBottom: '6px' }}>CUSTOMISE</div>
                {showGuestsHint && (
                  <div style={st.hint}>
                    <span>{`${more.more} more guest${more.more === 1 ? '' : 's'} than the booking (${bookedGuests} booked, ${guestsNow} now). Your rate card adds ${rs(more.amount)} for them.`}</span>
                    <button type="button" style={st.link}
                      onClick={() => guestsLineAt >= 0
                        ? changeLine(guestsLineAt, { label: extraGuestsLabel(more.more), amount: more.amount })
                        : addLine(extraGuestsLabel(more.more), { amount: more.amount })}>
                      {guestsLineAt >= 0 ? `Update the line to ${rs(more.amount)}` : '+ Add to the quote'}
                    </button>
                  </div>
                )}
                {hints.map(h => (
                  <div key={h.kind} style={st.hint}>
                    <span>{h.text}</span>
                    <button type="button" style={st.link}
                      onClick={() => addLine(h.kind === 'early' ? 'Early Check-in' : 'Late Check-out', h.time ? (h.kind === 'early' ? { earlyCheckinTime: h.time } : { lateCheckoutTime: h.time }) : {})}>
                      + Add to the quote
                    </button>
                  </div>
                ))}
                <div style={st.perNight}>
                  <span>Per night: <strong style={{ color: 'var(--gold)' }}>{rs(direct.perNight)}</strong></span>
                  <span>25%: <strong style={{ color: 'var(--gold)' }}>{rs(shares.quarter)}</strong></span>
                  <span>50%: <strong style={{ color: 'var(--gold)' }}>{rs(shares.half)}</strong></span>
                </div>
                <div className="field" style={{ marginBottom: lines.length ? '8px' : 0 }}>
                  <select className="field-input" value="" onChange={e => { if (e.target.value) addLine(e.target.value); e.target.value = '' }}>
                    <option value="">+ Add item… (early check-in, breakfast, floor bed)</option>
                    {EXTRA_ITEMS.map(x => <option key={x.label} value={x.label}>{x.label}</option>)}
                  </select>
                </div>
                {lines.map((l, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ flex: 1, fontSize: '0.85rem' }}>{l.label}</span>
                      <input type="number" value={l.amount} placeholder="0" onChange={e => changeLine(i, { amount: e.target.value })} style={st.amountInput} />
                      <button type="button" onClick={() => removeLine(i)} aria-label={`Remove ${l.label}`} style={st.remove}>✕</button>
                    </div>
                    {(isEarlyLabel(l.label) || isLateLabel(l.label)) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '4px', paddingLeft: '2px' }}>
                        {isEarlyLabel(l.label) && (
                          <label style={st.timeLabel}>Arrival time
                            <input type="time" value={l.earlyCheckinTime || ''} onChange={e => changeLine(i, { earlyCheckinTime: e.target.value })} style={st.timeInput} />
                          </label>
                        )}
                        {isLateLabel(l.label) && (
                          <label style={st.timeLabel}>Departure time
                            <input type="time" value={l.lateCheckoutTime || ''} onChange={e => changeLine(i, { lateCheckoutTime: e.target.value })} style={st.timeInput} />
                          </label>
                        )}
                        <button type="button" style={st.link} onClick={() => changeLine(i, { amount: shares.quarter })}>25%</button>
                        <button type="button" style={st.link} onClick={() => changeLine(i, { amount: shares.half })}>50%</button>
                        {((isEarlyLabel(l.label) && !l.earlyCheckinTime) || (isLateLabel(l.label) && !l.lateCheckoutTime)) && (
                          <span style={{ ...st.small, color: '#C8903A' }}>Add the hour: the quote then says it.</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* The quote: copy it, or open the guest's WhatsApp with it ready (not sent for you). Same two buttons as an enquiry. */}
                {quoteInput ? (
                  <>
                    <button type="button" onClick={copyQuote} className="btn btn-teal" style={{ marginTop: '12px' }}>📋 Generate & copy WhatsApp quote</button>
                    {waLink ? (
                      <a href={waLink} target="_blank" rel="noreferrer" className="btn"
                        style={{ marginTop: '8px', display: 'block', textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', fontWeight: '700' }}>
                        💬 Send quote in WhatsApp
                      </a>
                    ) : (
                      <div style={{ ...st.small, marginTop: '8px' }}>There is no phone number on this booking: copy the quote and paste it into the guest's chat.</div>
                    )}
                  </>
                ) : (
                  <div style={{ ...st.small, marginTop: '12px', color: '#E8A33D' }}>Put in the room price above and the quote appears here.</div>
                )}
                {toast && <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#34A853' }}>{toast}</div>}
                <div style={{ ...st.small, marginTop: '10px' }}>
                  Nothing here is saved or changed: the direct side starts from this booking's saved price or your rate card, every figure on it can be typed over, and the quote is only a message.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// One line of a side: a label and a figure.
function Row({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '3px 0', fontSize: '0.82rem', fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid var(--border-dim)' : 'none', marginTop: bold ? '4px' : 0, paddingTop: bold ? '6px' : '3px' }}>
      <span style={{ color: bold ? 'var(--text)' : 'var(--text-dim)' }}>{label}</span>
      <span style={{ color: color || 'var(--text)' }}>{value}</span>
    </div>
  )
}

// The look of the card: the same dark card, gold and dim text the rest of Complete booking uses.
const st = {
  small: { fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.45 },
  sub: { fontSize: '0.7rem', color: 'var(--text-dim)', margin: '0 0 4px' },
  threeCols: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' },
  sides: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px', margin: '12px 0' },
  side: { border: '1px solid var(--border-dim)', borderRadius: '10px', padding: '10px 12px' },
  sideTitle: { fontSize: '0.68rem', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase' },
  basisRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '2px 0 8px' },
  pill: { padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--border-dim)', background: 'none', color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer' },
  pillOn: { borderColor: 'rgba(200,144,58,0.7)', color: 'var(--gold)', background: 'rgba(200,144,58,0.1)' },
  roomRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '3px 0', fontSize: '0.82rem' },
  metric: { background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 12px' },
  metricNum: { fontSize: '1.3rem', fontWeight: 700 },
  hint: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.78rem', padding: '7px 10px', borderRadius: '8px', background: 'rgba(200,144,58,0.08)', border: '1px solid rgba(200,144,58,0.25)', marginBottom: '8px' },
  link: { background: 'none', border: 'none', color: '#85B7EB', cursor: 'pointer', fontSize: '0.74rem', textDecoration: 'underline', padding: 0 },
  perNight: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(200,144,58,0.06)', border: '1px solid rgba(200,144,58,0.15)', fontSize: '0.72rem', color: 'var(--text-dim)' },
  amountInput: { width: '90px', padding: '5px 8px', borderRadius: '6px', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', color: 'var(--gold)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' },
  remove: { background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '1rem' },
  timeLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-dim)' },
  timeInput: { padding: '4px 6px', borderRadius: '6px', background: 'var(--dark-input)', border: '1px solid var(--border-dim)', color: 'var(--text)', fontSize: '0.78rem' },
}
