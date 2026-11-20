import { useState, useEffect } from 'react'
import { useBack } from '../../utils/navTrail'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { DEFAULT_VILLA_ID } from '../../utils/villaContext'
import UpiQr from '../../components/UpiQr'
import { upiLink, inr, PAY_MODES, TIP_PRESETS, MAX_TIP } from '../../utils/checkoutInvoice'

// Low-stock threshold matches Inventory.jsx's Stock tab exactly (10% of
// preferred level) so both screens agree on what counts as "low."
function isLowStock(qtyInStock, preferred) {
  const threshold = Math.ceil((preferred || 0) * 0.1)
  return (preferred || 0) > 0 && (qtyInStock || 0) <= threshold
}

// A guest whose stay period has ended but hasn't been formally checked
// out yet ('ready_for_checkout') is NOT historical — saving here should
// still run the actual checkout (handleSave's existing `!isHistoricalSession`
// check already does this correctly once this is set right). Only an
// already-processed checked_out/closed stay is historical/retroactive.
function guestLabel(g) {
  if (g.status === 'checked_in') return `🟢 ${g.guestName} — active stay`
  if (g.status === 'ready_for_checkout') return `🟡 ${g.guestName} — ready for checkout`
  return `${g.guestName} — checked out ${g.checkoutDate}`
}

// Builds a wa.me deep-link pre-filled with the itemized incidentals
// breakup, same pattern as EnquiryDetail.jsx's quote-sending link — opens
// the guest's WhatsApp chat with the message ready, Raman still taps send
// himself (never auto-sent).
function buildInvoiceWaLink(stay, lines, total) {
  const phone = stay?.guestPhone
  if (!phone) return null
  const raw = String(phone).replace(/\D/g, '')
  const num = raw.startsWith('91') ? raw : (raw.length === 10 ? `91${raw}` : raw)
  const firstName = (stay.guestName || '').trim().split(' ')[0] || 'there'
  const message = [
    `Hi ${firstName}, here's your check-out incidentals summary:`,
    '',
    ...lines,
    '',
    `Total: ₹${total.toLocaleString('en-IN')}`,
    '',
    'Thank you for staying with us!',
  ].join('\n')
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`
}

// A choice chip (tip amount, how it was paid).
function Chip({ label, on, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      style={{
        padding: '8px 14px', borderRadius: '18px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${on ? 'var(--gold)' : 'var(--border-dim)'}`,
        background: on ? 'rgba(200,144,58,0.15)' : 'transparent',
        color: on ? 'var(--gold)' : 'var(--text)',
      }}>
      {label}
    </button>
  )
}

export default function KitchenIncidentals() {
  const goBack = useBack()
  // Whose UPI the QR code pays: the villa's manager (Raman) for now. He is the one at the gate who tallies the bill and collects.
  const villa = CONFIG.villas.find(v => v.id === DEFAULT_VILLA_ID) || CONFIG.villas.find(v => v.active) || CONFIG.villas[0] || {}
  const payeeUpi = villa.managerUpi || ''
  const payeeName = villa.managerName || 'Manager'
  const [stay, setStay]     = useState(null)
  const [cart, setCart]     = useState({})
  // Live catalog (kitchen category, active items only) — was previously a
  // hardcoded import-time snapshot that never reflected archived/renamed/
  // added items from the Inventory screen. Now fetched the same way
  // Inventory.jsx and PreferredStock.jsx already do.
  const [checkoutItems, setCheckoutItems] = useState([])
  const [prices, setPrices] = useState({})
  const [stock, setStock]   = useState({})
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]         = useState(null)
  // Combined list: active stay (if any) first, then recent checkouts —
  // always offered together so Raman can log a just-checked-out guest's
  // charges (kitchen/breakfast/car rental often land 1-2 days late) even
  // after a new guest has already checked in and become the active stay.
  const [guestOptions, setGuestOptions] = useState([])
  const [custom, setCustom] = useState({ name: '', price: '', qty: 0 })
  // Payment at check-out: the tip the guest adds for the team (0 = none, a preset, or 'other' with the typed amount), how it was
  // paid, and what the last save recorded (the invoice the guest can be sent).
  const [tipChoice, setTipChoice] = useState(0)
  const [tipOther, setTipOther]   = useState('')
  const [payMode, setPayMode]     = useState('')
  const [receipt, setReceipt]     = useState(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailedTo, setEmailedTo] = useState('')

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    Promise.all([
      api.getActiveStay(DEFAULT_VILLA_ID).catch(() => null),
      api.getRecentCheckouts(DEFAULT_VILLA_ID).catch(() => []),
    ]).then(([active, checkouts]) => {
      const options = [
        ...(active && active.stayId ? [{
          stayId: active.stayId, guestName: active.guestName || 'Active Guest',
          guestPhone: active.guest_phone || '',
          checkoutDate: active.checkoutDate || '—', nights: active.nights || '—',
          status: 'checked_in', isHistoricalSession: false,
        }] : []),
        ...(Array.isArray(checkouts) ? checkouts.map(c => ({
          stayId: c.stay_id, guestName: c.guest_name, guestPhone: c.guest_phone || '',
          checkoutDate: c.checkout_date, nights: c.nights || 1,
          status: c.status, isHistoricalSession: c.status !== 'ready_for_checkout',
        })) : []),
      ]
      setGuestOptions(options)
      if (options.length) setStay(options[0])
    })

    api.getInventory(DEFAULT_VILLA_ID)
      .then(rows => {
        if (!Array.isArray(rows)) return
        const kitchenRows = rows.filter(r => (r.category || 'other') === 'kitchen')
        setCheckoutItems(kitchenRows.map(r => ({ id: r.item_id, name: r.name, unit: r.unit || 'unit', sellPrice: r.sell_price ?? 0 })))
        setPrices(Object.fromEntries(kitchenRows.map(r => [r.item_id, r.sell_price ?? 0])))
        setStock(Object.fromEntries(kitchenRows.map(r => [r.item_id, {
          qtyInStock: r.qty_in_stock ?? 0, preferredStock: r.preferred_stock ?? 10,
        }])))
      })
      .catch(() => {})
  }, [])

  const setQty = (id, qty) => setCart(c => ({ ...c, [id]: Math.max(0, qty) }))
  const itemTotal = (id) => (cart[id] || 0) * (Number(prices[id]) || 0)
  const total = checkoutItems.reduce((s, i) => s + itemTotal(i.id), 0)
    + (custom.qty || 0) * (parseFloat(custom.price) || 0)
  const invoiceLines = [
    ...checkoutItems.filter(i => (cart[i.id] || 0) > 0)
      .map(i => `${i.name} × ${cart[i.id]} = ₹${itemTotal(i.id).toLocaleString('en-IN')}`),
    ...(custom.qty > 0 && custom.name
      ? [`${custom.name} × ${custom.qty} = ₹${(custom.qty * (parseFloat(custom.price) || 0)).toLocaleString('en-IN')}`]
      : []),
  ]
  const invoiceWaLink = total > 0 ? buildInvoiceWaLink(stay, invoiceLines, total) : null

  // What the guest pays now: the items plus the tip. The QR code carries exactly this amount.
  const tip = tipChoice === 'other'
    ? Math.max(0, Math.min(MAX_TIP, Math.round(Number(tipOther) || 0)))
    : (Number(tipChoice) || 0)
  const collect = total + tip
  const upi = total > 0 ? upiLink({ vpa: payeeUpi, name: payeeName, amount: collect, note: `${villa.name || 'Villa'} check-out` }) : ''

  const handleSave = async () => {
    const items = [
      ...checkoutItems
        .filter(i => (cart[i.id] || 0) > 0)
        .map(i => ({
          itemId: i.id, name: i.name, qty: cart[i.id],
          pricePerUnit: Number(prices[i.id]) || i.sellPrice,
          subtotal: itemTotal(i.id),
        })),
      ...(custom.qty > 0 && custom.name ? [{
        itemId: 'custom', name: custom.name, qty: custom.qty,
        pricePerUnit: parseFloat(custom.price) || 0,
        subtotal: custom.qty * (parseFloat(custom.price) || 0),
      }] : []),
    ]
    if (!items.length) { showToast('Add at least one item', 'error'); return }
    setSaving(true)
    // How the guest paid, and the tip they added, as they stand now (the form is cleared below).
    const pay = payMode ? { mode: payMode, tip } : null

    // 1) Save the incidentals. If this fails, surface the real reason and stop.
    let saveResult
    try {
      saveResult = await api.saveKitchenEntry({ stayId: stay?.stayId, guestName: stay?.guestName, items, totalAmount: total, notes, villaId: DEFAULT_VILLA_ID })
    } catch (e) {
      showToast(e?.message || 'Failed to save incidentals', 'error')
      setSaving(false)
      return
    }

    // Incidentals are saved — clear the form now so a checkout retry can't re-add them.
    setCart({}); setNotes(''); setCustom({ name: '', price: '', qty: 0 })
    setPayMode(''); setTipChoice(0); setTipOther('')
    setReceipt(null); setEmailedTo('')

    // 2) Check the guest out (skip for historical/retroactive sessions).
    try {
      let commMsg = ''
      if (stay && !stay.isHistoricalSession) {
        const result = await api.checkOut({ stayId: stay?.stayId })
        if (result?.commissionCreated) commMsg = ` · Raman ₹${result.ramanComm} commission logged`
      } else {
        commMsg = ' · Retroactive items added'
      }
      showToast(`Check-out saved ✓${commMsg}`)
      if (stay?.isHistoricalSession) setStay(null)
    } catch (e) {
      showToast(`Items saved, but checkout step failed: ${e?.message || 'error'}`, 'error')
    }

    // 3) Record how it was paid and get the invoice ready. This never holds up the check-out above: if it fails the guest is still
    //    checked out and Raman is told the payment note did not save.
    if (pay && stay?.stayId) {
      try {
        const rec = await api.recordCheckoutPayment({
          stayId: stay.stayId, mode: pay.mode, tip: pay.tip,
          items: items.map(i => ({ name: i.name, qty: i.qty, pricePerUnit: i.pricePerUnit })),
        })
        setReceipt({ ...rec, guestName: stay.guestName, guestPhone: stay.guestPhone })
      } catch (e) {
        setTimeout(() => showToast(`The payment note did not save: ${e?.message || 'error'}. Tell the owner what was paid.`, 'error'), 1200)
      }
    }

    // Low-stock warnings from the save step.
    const lowStockAlerts = saveResult?.lowStockAlerts || []
    if (lowStockAlerts.length) {
      const names = lowStockAlerts.map(a => `${a.name} (${a.qtyInStock} left)`).join(', ')
      setTimeout(() => showToast(`⚠️ Low stock: ${names}`, 'error'), 1200)
    }
    setSaving(false)
  }

  const receiptHere = receipt && stay && receipt.stayId === stay.stayId ? receipt : null
  const receiptWaLink = receiptHere && receiptHere.whatsapp && receiptHere.waNumber
    ? `https://wa.me/${receiptHere.waNumber}?text=${encodeURIComponent(receiptHere.whatsapp)}`
    : null

  const sendInvoiceEmail = async () => {
    if (!receiptHere) return
    setEmailBusy(true)
    try {
      const r = await api.sendCheckoutInvoiceEmail({ stayId: receiptHere.stayId, ref: receiptHere.ref })
      setEmailedTo(r?.to || 'the guest')
      showToast(r?.alreadySent ? `Already emailed to ${r.to}` : `Invoice emailed to ${r?.to || 'the guest'} ✓`)
    } catch (e) {
      showToast(e?.message || 'Could not send the email', 'error')
    } finally { setEmailBusy(false) }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={goBack}>‹</button>
        <div>
          <div className="topbar-title">Check-out incidentals</div>
          <div className="topbar-sub">{stay?.guestName || 'No active stay'} · DWARKA</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      <div className="screen-body">
        <div className="card" style={{ padding: '14px', marginBottom: '12px', background: 'var(--card-bg)' }}>
          {guestOptions.length > 0 ? (
            <>
              <label style={{ display: 'block', fontSize: '0.65rem', color: '#5C7080', marginBottom: '6px', fontWeight: '600', letterSpacing: '1px' }}>
                GUEST CONTEXT — who are these charges for?
              </label>
              <select
                value={stay?.stayId || ''}
                onChange={(e) => {
                  const chosen = guestOptions.find(g => g.stayId === e.target.value)
                  if (chosen) setStay(chosen)
                }}
                className="field-input"
                style={{ width: '100%', background: '#1A202C', color: '#FFF', padding: '8px', borderRadius: '6px', border: '1px solid rgba(200,144,58,0.3)' }}
              >
                {guestOptions.map(g => (
                  <option key={g.stayId} value={g.stayId}>
                    {guestLabel(g)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No active stay or recent checkouts found.</div>
          )}
        </div>

        <div className="card-section-label">KITCHEN INCIDENTALS
          <span style={{ color: '#5C7080', fontWeight: 400, fontSize: '0.7rem', marginLeft: '6px' }}>prices from inventory</span>
        </div>
        <div className="card">
          {checkoutItems.map((item, i) => {
            const qty   = cart[item.id] || 0
            const price = Number(prices[item.id]) || item.sellPrice
            const sub   = qty * price
            const s     = stock[item.id] || {}
            const preferred = s.preferredStock ?? 10
            const low   = isLowStock(s.qtyInStock, preferred)
            return (
              <div key={item.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                paddingBottom: '12px', marginBottom: '12px',
                borderBottom: i < checkoutItems.length - 1 ? '1px solid var(--border-dim)' : 'none',
                alignItems: 'center', gap: '8px',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontSize: '0.88rem', fontWeight: '500' }}>{item.name}</div>
                  <div style={{ color: '#5C7080', fontSize: '0.72rem', display: 'flex', flexWrap: 'wrap', columnGap: '6px', rowGap: '2px' }}>
                    <span style={{ whiteSpace: 'nowrap' }}><span className="rupee">₹</span>{price} / {item.unit}</span>
                    {sub > 0 && <span style={{ color: 'var(--gold)', fontWeight: '700', whiteSpace: 'nowrap' }}>= <span className="rupee">₹</span>{sub.toLocaleString('en-IN')}</span>}
                    <span style={{ whiteSpace: 'nowrap', color: low ? '#EF9A9A' : '#5C7080' }}>
                      · {s.qtyInStock ?? 0} in stock
                    </span>
                    {low && <span style={{ color: '#EF9A9A', fontSize: '0.7rem' }}>⚠️ Low (target {preferred})</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => setQty(item.id, qty - 1)}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer' }}>−</button>
                  <span style={{ color: 'var(--gold)', fontWeight: '700', minWidth: '22px', textAlign: 'center', fontSize: '0.95rem' }}>{qty}</span>
                  <button onClick={() => setQty(item.id, qty + 1)}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            )
          })}

          <div style={{ paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#5C7080', fontSize: '0.72rem', marginBottom: '8px' }}>AD-HOC / OTHER</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 50px', gap: '6px', alignItems: 'center' }}>
              <input className="field-input" placeholder="Item name"
                value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))}
                style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
              <input className="field-input" placeholder="₹/unit" type="number"
                value={custom.price} onChange={e => setCustom(c => ({ ...c, price: e.target.value }))}
                style={{ fontSize: '0.82rem', padding: '6px 8px', color: 'var(--gold)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => setCustom(c => ({ ...c, qty: Math.max(0, c.qty - 1) }))}
                  style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.9rem' }}>−</button>
                <span style={{ color: 'var(--gold)', fontWeight: '700', fontSize: '0.9rem', minWidth: '16px', textAlign: 'center' }}>{custom.qty}</span>
                <button onClick={() => setCustom(c => ({ ...c, qty: c.qty + 1 }))}
                  style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.9rem' }}>+</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="field-label">Notes (optional)</div>
            <input className="field-input" placeholder="Any special requests or notes..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="net-box">
          {checkoutItems.filter(i => (cart[i.id] || 0) > 0).map(i => (
            <div key={i.id} className="net-row">
              <span className="net-label">{i.name} × {cart[i.id]}</span>
              <span className="net-val pos"><span className="rupee">₹</span>{itemTotal(i.id).toLocaleString('en-IN')}</span>
            </div>
          ))}
          {custom.qty > 0 && custom.name && (
            <div className="net-row">
              <span className="net-label">{custom.name} × {custom.qty}</span>
              <span className="net-val pos"><span className="rupee">₹</span>{(custom.qty * (parseFloat(custom.price) || 0)).toLocaleString('en-IN')}</span>
            </div>
          )}
          {total > 0 && <div className="net-divider" />}
          <div className="net-row">
            <span style={{ color: 'var(--text)', fontWeight: '700', fontSize: '1rem' }}>Total incidentals</span>
            <span className="net-val big"><span className="rupee">₹</span>{total.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {total > 0 && (
          <div className="card" data-testid="collect-payment">
            <div className="card-section-label" style={{ marginTop: 0 }}>COLLECT PAYMENT</div>
            <div style={{ color: '#5C7080', fontSize: '0.72rem', margin: '4px 0 8px' }}>Tip for the team (optional)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <Chip label="No tip" on={tipChoice === 0} onClick={() => setTipChoice(0)} />
              {TIP_PRESETS.map(t => <Chip key={t} label={`₹${t}`} on={tipChoice === t} onClick={() => setTipChoice(t)} />)}
              <Chip label="Other" on={tipChoice === 'other'} onClick={() => setTipChoice('other')} />
            </div>
            {tipChoice === 'other' && (
              <input className="field-input" type="number" inputMode="numeric" min="0" max={MAX_TIP} placeholder="Tip in rupees"
                value={tipOther} onChange={e => setTipOther(e.target.value)} style={{ marginTop: '8px' }} />
            )}

            <div style={{ textAlign: 'center', margin: '16px 0 8px' }}>
              <div style={{ color: 'var(--text)', fontWeight: '700', fontSize: '1.3rem' }}>Collect <span className="rupee">₹</span>{collect.toLocaleString('en-IN')}</div>
              {tip > 0 && <div style={{ color: '#5C7080', fontSize: '0.75rem' }}>₹{total.toLocaleString('en-IN')} items + ₹{tip.toLocaleString('en-IN')} tip</div>}
            </div>

            {upi ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#fff', padding: '8px', borderRadius: '10px', maxWidth: '100%' }}>
                  <UpiQr value={upi} size={220} label={`UPI QR code to pay ${inr(collect)}`} />
                </div>
                <div style={{ color: '#5C7080', fontSize: '0.72rem', textAlign: 'center' }}>
                  The guest scans this with any UPI app (GPay, PhonePe, Paytm). It pays {payeeName}.
                </div>
              </div>
            ) : (
              <div style={{ color: '#EF9A9A', fontSize: '0.78rem', textAlign: 'center' }}>
                No UPI ID is set up for this villa, so there is no QR code. You can still record cash or card below.
              </div>
            )}

            <div style={{ color: '#5C7080', fontSize: '0.72rem', margin: '14px 0 8px' }}>
              How was it paid? Look for the payment alert on your own phone first.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PAY_MODES.map(m => <Chip key={m} label={m} on={payMode === m} onClick={() => setPayMode(payMode === m ? '' : m)} />)}
            </div>
            {payMode && (
              <div style={{ color: '#34A853', fontSize: '0.75rem', marginTop: '10px' }}>
                Save will record {inr(collect)} paid by {payMode}{tip > 0 ? `, tip ${inr(tip)} included` : ''}, and the invoice can then be sent.
              </div>
            )}
          </div>
        )}

        <button className="btn btn-gold" onClick={handleSave} disabled={saving || total === 0 || !stay}>
          {saving ? 'Saving...' : !stay ? 'Select a guest context above' : total > 0 ? <>Save · <span className="rupee">₹</span>{total.toLocaleString('en-IN')} →</> : 'Add items above'}
        </button>
        <p className="btn-email-note">📧 Owner notified on save</p>

        {receiptHere && (
          <div className="card" data-testid="invoice-ready" style={{ marginTop: '12px', border: '1px solid rgba(52,168,83,0.4)' }}>
            <div style={{ color: '#34A853', fontWeight: '700', fontSize: '0.95rem' }}>
              ✅ Paid {inr(receiptHere.total)} by {receiptHere.mode}{receiptHere.tip > 0 ? ` (includes ${inr(receiptHere.tip)} tip)` : ''}
            </div>
            <div style={{ color: '#5C7080', fontSize: '0.72rem', margin: '2px 0 10px' }}>Reference {receiptHere.ref} · {receiptHere.guestName}</div>
            {receiptHere.invoiceError ? (
              <p style={{ fontSize: '0.78rem', color: '#EF9A9A', margin: '0 0 8px' }}>{receiptHere.invoiceError}</p>
            ) : receiptWaLink ? (
              <a href={receiptWaLink} target="_blank" rel="noreferrer" className="btn"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', fontWeight: '700' }}>
                📲 Send invoice on WhatsApp
              </a>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0 0 8px' }}>No phone number on file — can't send on WhatsApp</p>
            )}
            {!receiptHere.invoiceError && (receiptHere.hasEmail ? (
              <button type="button" className="btn" onClick={sendInvoiceEmail} disabled={emailBusy}
                style={{ display: 'block', width: '100%', marginTop: '8px', textAlign: 'center', fontWeight: '700' }}>
                {emailBusy ? 'Sending...' : emailedTo ? `✉️ Emailed to ${emailedTo} — send again` : '✉️ Send invoice by email'}
              </button>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '8px 0 0' }}>No email on file — can't send by email</p>
            ))}
          </div>
        )}

        {total > 0 && (
          invoiceWaLink ? (
            <a href={invoiceWaLink} target="_blank" rel="noreferrer"
              className="btn"
              style={{
                marginTop: '8px', display: 'block', textAlign: 'center', textDecoration: 'none',
                background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)',
                color: '#25D366', fontWeight: '700',
              }}>
              📲 Send summary on WhatsApp
            </a>
          ) : (
            <p style={{ marginTop: '8px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              No phone number on file — can't send a summary
            </p>
          )
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
