// ============================================================
//  generatePdfPayoutVoucher.js
//  PDF version of generatePayoutVoucher.js — a one-page "Payment
//  Voucher" for a move-in/move-out expense. No lessor-signature image
//  baked in (unlike the tenant-facing receipts) -- this is an internal
//  expense record, just a signature line for the owner/rep to sign.
// ============================================================
import { CONFIG } from '../config'
import { localTodayStr } from './dates'
import { createPdfWithCursor, triggerPdfDownload, drawSingleSignatureBlock, fmtLongDate, fmtCurrency, fmtCurrencyWords } from './pdfGenHelpers'

async function buildVoucherPdf({ property, vendorName, amount, currency, paidDate, category, description, executionCity, ownerName, agreedRent }) {
  const { doc, cursor } = await createPdfWithCursor()
  const today = localTodayStr()
  const propLabel = property?.fullAddress || (property?.building
    ? `${property.building}, ${property.city || property.location || ''}`
    : (property?.name || '[PROPERTY]'))
  const purpose = description ? `${category} — ${description}` : category

  cursor.drawLine('PAYMENT VOUCHER', { size: 18, bold: true, align: 'center', spacingAfter: 6 })
  cursor.drawLine(`Voucher Date: ${fmtLongDate(today)}`, { size: 10, align: 'right', spacingAfter: 18 })

  cursor.drawRuns([
    { text: 'Paid to ' },
    { text: vendorName, bold: true },
    { text: ' the sum of ' },
    { text: fmtCurrency(amount, currency), bold: true },
    { text: ` (${fmtCurrencyWords(amount, currency)}) ` },
    { text: `towards ${purpose} for the property at ` },
    { text: propLabel, bold: true },
    { text: '.' },
  ], { size: 11, spacingAfter: 16 })

  cursor.drawTwoCol('Payment Date:', fmtLongDate(paidDate), { spacingAfter: 6 })
  cursor.drawTwoCol('Category:', category, { spacingAfter: 6 })
  // Realty Commission is conventionally a percentage of monthly rent
  // (typically half a month's rent, i.e. 50%) — showing the basis makes
  // the voucher self-explanatory rather than just a bare amount.
  if (category === 'Realty Commission' && agreedRent > 0) {
    const pct = Math.round((amount / agreedRent) * 100)
    cursor.drawTwoCol('Rent Amount:', fmtCurrency(agreedRent, currency), { spacingAfter: 6 })
    cursor.drawTwoCol('Commission Basis:', `${pct}% of Rent Amount`, { spacingAfter: 6 })
  }
  cursor.drawTwoCol('Amount Paid:', fmtCurrency(amount, currency), { bold: true, spacingAfter: 16 })

  cursor.drawRuns([
    { text: 'This voucher confirms only that the above payment was made. It is an internal expense record and does not itself constitute a receipt from the vendor.' },
  ], { size: 9, spacingAfter: 16 })

  cursor.drawLine(`Place: ${executionCity || '—'}`, { size: 10, spacingAfter: 10 })

  await drawSingleSignatureBlock(cursor, { signerName: ownerName, dateStr: paidDate, label: '(Paid by / on behalf of Owner)' })

  return doc
}

export async function downloadPayoutVoucherPdf(expense, property) {
  const missing = []
  if (!expense?.vendor_name) missing.push('Vendor name')
  if (!expense?.amount)      missing.push('Amount')
  if (missing.length) {
    throw new Error(`Cannot generate payout voucher — missing: ${missing.join(', ')}. Fill these in and save first.`)
  }
  const currency = expense.currency || 'INR'
  const lease = currency === 'INR' ? CONFIG.leaseIndia : null
  const doc = await buildVoucherPdf({
    property,
    vendorName: expense.vendor_name,
    amount: expense.amount,
    currency,
    paidDate: expense.paid_date || localTodayStr(),
    category: expense.category,
    description: expense.description || '',
    executionCity: property?.city || property?.location || lease?.executionCity || '',
    ownerName: lease?.lessorName || '[OWNER]',
    agreedRent: parseFloat(expense.agreed_rent) || 0,
  })
  await triggerPdfDownload(doc, `Payout Voucher - ${property.name} - ${expense.vendor_name}.pdf`)
}
