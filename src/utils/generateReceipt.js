// ============================================================
//  generateReceipt.js
//  Generates a one-page "Receipt of Payment" .docx — used both for
//  the security deposit (a one-off, separate from the rent ledger)
//  and for any posted rent_transactions row (a specific month's rent,
//  with or without a late fee).
//
//  Deliberately reads from a SAVED record (the agreement for deposit
//  receipts, a posted rent_transactions row for rent receipts) rather
//  than live unsaved form state — same reasoning as the Lease Deed
//  generator: a receipt is a claim that money was actually received,
//  so it should only ever reflect something that's actually been
//  saved/posted, never an in-progress edit.
// ============================================================
import { Document, Packer, Paragraph, AlignmentType } from 'docx'
import { CONFIG } from '../config'
import { localTodayStr } from './dates'
import { fmtLongDate, fmtCurrency, fmtCurrencyWords, p, r, centerLabel, twoColRow } from './docGenHelpers'

function buildReceiptDocument({ property, tenantName, tenantAddress, amount, currency, paymentDate, paymentMode, referenceNo, purpose, lessorName, executionCity, isDeposit }) {
  const today = localTodayStr()
  const children = [
    centerLabel('RECEIPT OF PAYMENT', { size: 28 }),
    p(r(`Receipt Date: ${fmtLongDate(today)}`, { size: 20 }), { align: AlignmentType.RIGHT, spacing: { after: 400 } }),

    p([
      r('Received with thanks from '),
      r(tenantName, { bold: true }),
      r(tenantAddress ? `, residing at ${tenantAddress}, ` : ', '),
      r('the sum of '),
      r(fmtCurrency(amount, currency), { bold: true }),
      r(` (${fmtCurrencyWords(amount, currency)}) `),
      r(`towards ${purpose} for the property at `),
      r(property?.building ? `${property.building}, ${property.city || property.location || ''}` : (property?.name || '[PROPERTY]'), { bold: true }),
      r('.'),
    ], { spacing: { after: 300 } }),

    twoColRow('Payment Date:', fmtLongDate(paymentDate), { before: 100, after: 80 }),
    twoColRow('Payment Mode:', paymentMode || '—', { before: 0, after: 80 }),
    ...(referenceNo ? [twoColRow('Reference No.:', referenceNo, { before: 0, after: 80 })] : []),
    twoColRow('Amount Received:', fmtCurrency(amount, currency), { before: 0, after: isDeposit ? 300 : 400 }),

    p(r('This receipt confirms only that the above payment has been received. It does not by itself constitute a lease agreement or waive any other amount due under the tenancy.', { size: 18 }), { spacing: { after: isDeposit ? 200 : 600 } }),

    // Deposit-specific refund/deduction terms — per explicit decision
    // (2026-06-28), generic and firm rather than itemized-threatening:
    // states the protective principle (property returned as given) and
    // names the categories deductions can come from, without dollar
    // figures or accusatory framing. Only shown on deposit receipts —
    // this language has no place on a monthly rent receipt.
    ...(isDeposit ? [
      p(r('Security Deposit Terms', { bold: true, size: 18 }), { spacing: { after: 80 } }),
      p(r('This deposit will be refunded within 30 days of move-out. Any deductions needed\u2014such as for unpaid rent, outstanding utility bills, property damage, painting restoration, or required cleaning\u2014will be subtracted and itemized before the balance is refunded.', { size: 18 }), { spacing: { after: 600 } }),
    ] : []),

    twoColRow('Place: ' + (executionCity || '—'), '', { before: 200, after: 100 }),
    twoColRow('', '', { before: 0, after: 600 }),
    twoColRow('_______________________', '', { before: 0, after: 60 }),
    twoColRow((lessorName || '[LESSOR]').toUpperCase(), '', { before: 0, after: 0, bold: true }),
    p(r('(Received by / on behalf of Lessor)', { size: 18 }), { spacing: { before: 60 } }),
  ]

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4, matches the lease deed
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  })
}

/**
 * Receipt for the security deposit — reads straight from the saved
 * agreement record (deposit, tenant identity), since the deposit isn't
 * tracked in rent_transactions (it's a one-off, not a monthly posting).
 */
export async function downloadDepositReceipt(agreement, property) {
  const missing = []
  if (!agreement.tenant_name) missing.push('Tenant name')
  if (!agreement.deposit)     missing.push('Security deposit amount')
  if (missing.length) {
    throw new Error(`Cannot generate deposit receipt — missing: ${missing.join(', ')}. Fill these in and save first.`)
  }
  const currency = agreement.currency || 'INR'
  // CONFIG.leaseIndia (lessor name/address/bank/executionCity) is real data
  // for India tenancies only — there is no equivalent CONFIG.leaseUSA yet
  // (no US lessor/bank details have been provided). Only use it for INR;
  // for any other currency, fall back to the property's own city rather
  // than silently stamping an Indian lessor's city onto a US document.
  const lease = currency === 'INR' ? CONFIG.leaseIndia : null
  const doc = buildReceiptDocument({
    property,
    tenantName: agreement.tenant_name,
    tenantAddress: agreement.tenant_address || '',
    amount: agreement.deposit,
    currency,
    // Use the actual recorded payment date if one was given (e.g. the
    // Incoming Tenant card's "Mark Deposit Paid" date) rather than always
    // defaulting to today — a receipt should reflect when the money was
    // really received, not when the document happens to be generated.
    paymentDate: agreement._depositPaymentDate || localTodayStr(),
    paymentMode: agreement._depositPaymentMode || 'Bank Transfer',
    referenceNo: agreement._depositReferenceNo || '',
    purpose: 'the security deposit',
    isDeposit: true,
    lessorName: lease?.lessorName || '[LANDLORD NAME]',
    // "Place" on a receipt should reflect the PROPERTY's actual city, not
    // CONFIG.leaseIndia.executionCity (a single fixed value for every
    // India property, originally meant for the Lease Deed's "place of
    // execution" concept). property.city takes priority; executionCity is
    // only a last-resort fallback if a property somehow has no city set.
    executionCity: property?.city || property?.location || lease?.executionCity || '',
  })
  await triggerDownload(doc, `Deposit Receipt - ${property.name} - ${agreement.tenant_name}.docx`)
}

/**
 * Receipt for a specific posted rent_transactions row — amount/date
 * come from the ledger row itself, not from any live form field, so the
 * receipt always matches what was actually recorded as paid.
 */
export async function downloadRentReceipt(rentTxn, agreement, property) {
  if (!rentTxn) throw new Error('No rent transaction provided — post the payment to the ledger first.')
  const currency = rentTxn.currency || 'INR'
  const lease = currency === 'INR' ? CONFIG.leaseIndia : null
  const purpose = rentTxn.late_fee > 0
    ? `rent and late fee for ${rentTxn.period_month}`
    : `rent for ${rentTxn.period_month}`
  const doc = buildReceiptDocument({
    property,
    tenantName: agreement?.tenant_name || '[TENANT NAME]',
    tenantAddress: agreement?.tenant_address || '',
    amount: rentTxn.total_due,
    currency,
    paymentDate: rentTxn.paid_date,
    paymentMode: rentTxn._paymentMode || 'Bank Transfer',
    referenceNo: rentTxn._referenceNo || '',
    purpose,
    lessorName: lease?.lessorName || '[LANDLORD NAME]',
    executionCity: property?.city || property?.location || lease?.executionCity || '',
  })
  await triggerDownload(doc, `Rent Receipt - ${property.name} - ${rentTxn.period_month}.docx`)
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
