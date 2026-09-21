// ============================================================
//  generatePayoutVoucher.js
//  Generates a one-page "Payment Voucher" .docx for a move-in/move-out
//  expense (rev360_move_expenses row) — the inverse of a deposit/rent
//  receipt: this confirms the OWNER paid a vendor, not that the owner
//  received money from a tenant. Deliberately no lessor-signature image
//  (see generateReceipt.js's isDeposit terms) — a payout voucher is an
//  internal expense record, not a tenant-facing document.
// ============================================================
import { Document, Packer, Paragraph, AlignmentType } from 'docx'
import { CONFIG } from '../config'
import { localTodayStr } from './dates'
import { fmtLongDate, fmtCurrency, fmtCurrencyWords, p, r, centerLabel, twoColRow } from './docGenHelpers'

function buildVoucherDocument({ property, vendorName, amount, currency, paidDate, category, description, executionCity, ownerName, agreedRent }) {
  const today = localTodayStr()
  const propLabel = property?.fullAddress || (property?.building
    ? `${property.building}, ${property.city || property.location || ''}`
    : (property?.name || '[PROPERTY]'))
  const purpose = description ? `${category} — ${description}` : category

  const children = [
    centerLabel('PAYMENT VOUCHER', { size: 28 }),
    p(r(`Voucher Date: ${fmtLongDate(today)}`, { size: 20 }), { align: AlignmentType.RIGHT, spacing: { after: 400 } }),

    p([
      r('Paid to '),
      r(vendorName || '[VENDOR]', { bold: true }),
      r(' the sum of '),
      r(fmtCurrency(amount, currency), { bold: true }),
      r(` (${fmtCurrencyWords(amount, currency)}) `),
      r(`towards ${purpose} for the property at `),
      r(propLabel, { bold: true }),
      r('.'),
    ], { spacing: { after: 300 } }),

    twoColRow('Payment Date:', fmtLongDate(paidDate), { before: 100, after: 80 }),
    twoColRow('Category:', category, { before: 0, after: 80 }),
    // Realty Commission is conventionally a percentage of monthly rent
    // (typically half a month's rent, i.e. 50%) — showing the basis makes
    // the voucher self-explanatory rather than just a bare amount.
    ...(category === 'Realty Commission' && agreedRent > 0 ? [
      twoColRow('Rent Amount:', fmtCurrency(agreedRent, currency), { before: 0, after: 80 }),
      twoColRow('Commission Basis:', `${Math.round((amount / agreedRent) * 100)}% of Rent Amount`, { before: 0, after: 80 }),
    ] : []),
    twoColRow('Amount Paid:', fmtCurrency(amount, currency), { before: 0, after: 400 }),

    p(r('This voucher confirms only that the above payment was made. It is an internal expense record and does not itself constitute a receipt from the vendor.', { size: 18 }), { spacing: { after: 400 } }),

    twoColRow('Place: ' + (executionCity || '—'), '', { before: 100, after: 100 }),
    twoColRow('', '', { before: 0, after: 600 }),
    twoColRow('_______________________', '', { before: 0, after: 60 }),
    twoColRow((ownerName || '[OWNER]').toUpperCase(), '', { before: 0, after: 0, bold: true }),
    p(r('(Paid by / on behalf of Owner)', { size: 18 }), { spacing: { before: 60 } }),
  ]

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  })
}

async function triggerDownload(doc, filename) {
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * @param {object} expense - a saved rev360_move_expenses row
 * @param {object} property - a row from getAllProperties (usePropertyList)
 */
export async function downloadPayoutVoucher(expense, property) {
  const missing = []
  if (!expense?.vendor_name) missing.push('Vendor name')
  if (!expense?.amount)      missing.push('Amount')
  if (missing.length) {
    throw new Error(`Cannot generate payout voucher — missing: ${missing.join(', ')}. Fill these in and save first.`)
  }
  const currency = expense.currency || 'INR'
  const lease = currency === 'INR' ? CONFIG.leaseIndia : null
  const doc = buildVoucherDocument({
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
  await triggerDownload(doc, `Payout Voucher - ${property.name} - ${expense.vendor_name}.docx`)
}
