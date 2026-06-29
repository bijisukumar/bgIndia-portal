// ============================================================
//  generatePdfReceipt.js
//  PDF version of generateReceipt.js — generates a one-page "Receipt
//  of Payment" PDF for either the security deposit or a posted
//  rent_transactions row, with the lessor's signature image baked in
//  automatically above the printed name (per explicit decision,
//  2026-06-28 — see drawSignatureBlock in pdfGenHelpers.js for the
//  accepted tradeoff this represents).
//
//  Same data-sourcing rule as the docx version: reads from a SAVED
//  record, never live unsaved form state — a receipt is a claim that
//  money was actually received.
// ============================================================
import { CONFIG } from '../config'
import { localTodayStr } from './dates'
import {
  createPdfWithCursor, triggerPdfDownload, drawSignatureBlock,
  fmtLongDate, fmtCurrency, fmtCurrencyWords,
} from './pdfGenHelpers'

async function buildReceiptPdf({ property, tenantName, tenantAddress, amount, currency, paymentDate, paymentMode, referenceNo, purpose, lessorName, executionCity, isDeposit }) {
  const { doc, cursor } = await createPdfWithCursor()
  const today = localTodayStr()

  cursor.drawLine('RECEIPT OF PAYMENT', { size: 18, bold: true, align: 'center', spacingAfter: 6 })
  cursor.drawLine(`Receipt Date: ${fmtLongDate(today)}`, { size: 10, align: 'right', spacingAfter: 18 })

  const propLabel = property?.fullAddress || (property?.building
    ? `${property.building}, ${property.city || property.location || ''}`
    : (property?.name || '[PROPERTY]'))

  cursor.drawRuns([
    { text: 'Received with thanks from ' },
    { text: tenantName, bold: true },
    { text: tenantAddress ? `, residing at ${tenantAddress}, ` : ', ' },
    { text: 'the sum of ' },
    { text: fmtCurrency(amount, currency), bold: true },
    { text: ` (${fmtCurrencyWords(amount, currency)}) ` },
    { text: `towards ${purpose} for the property at ` },
    { text: propLabel, bold: true },
    { text: '.' },
  ], { size: 11, spacingAfter: 16 })

  cursor.drawTwoCol('Payment Date:', fmtLongDate(paymentDate), { spacingAfter: 6 })
  cursor.drawTwoCol('Payment Mode:', paymentMode || '—', { spacingAfter: 6 })
  if (referenceNo) cursor.drawTwoCol('Reference No.:', referenceNo, { spacingAfter: 6 })
  cursor.drawTwoCol('Amount Received:', fmtCurrency(amount, currency), { bold: true, spacingAfter: 16 })

  cursor.drawRuns([
    { text: 'This receipt confirms only that the above payment has been received. It does not by itself constitute a lease agreement or waive any other amount due under the tenancy.' },
  ], { size: 9, spacingAfter: 12 })

  // Deposit-specific refund/deduction terms — only on deposit receipts,
  // exact wording per explicit decision (2026-06-28). Never shown on a
  // monthly rent receipt, which has no refund-on-move-out concept.
  if (isDeposit) {
    cursor.drawLine('Security Deposit Terms', { size: 10, bold: true, spacingAfter: 4 })
    cursor.drawRuns([
      { text: 'This deposit will be refunded within 30 days of move-out. Any deductions needed\u2014such as for unpaid rent, outstanding utility bills, property damage, painting restoration, or required cleaning\u2014will be subtracted and itemized before the balance is refunded.' },
    ], { size: 9, spacingAfter: 16 })
  }

  cursor.drawLine(`Place: ${executionCity || '—'}`, { size: 10, spacingAfter: 10 })

  await drawSignatureBlock(cursor, { lessorName, dateStr: today })

  return doc
}

/**
 * Receipt for the security deposit — reads from the saved agreement
 * record (or an incoming_tenants record), since the deposit isn't
 * tracked in rent_transactions (a one-off, not a monthly posting).
 */
export async function downloadDepositReceiptPdf(agreement, property) {
  const missing = []
  if (!agreement.tenant_name) missing.push('Tenant name')
  if (!agreement.deposit)     missing.push('Security deposit amount')
  if (missing.length) {
    throw new Error(`Cannot generate deposit receipt — missing: ${missing.join(', ')}. Fill these in and save first.`)
  }
  const currency = agreement.currency || 'INR'
  const lease = currency === 'INR' ? CONFIG.leaseIndia : null
  const doc = await buildReceiptPdf({
    property,
    tenantName: agreement.tenant_name,
    tenantAddress: agreement.tenant_address || '',
    amount: agreement.deposit,
    currency,
    paymentDate: agreement._depositPaymentDate || localTodayStr(),
    paymentMode: agreement._depositPaymentMode || 'Bank Transfer',
    referenceNo: agreement._depositReferenceNo || '',
    purpose: 'the security deposit',
    isDeposit: true,
    lessorName: lease?.lessorName || '[LANDLORD NAME]',
    executionCity: property?.city || property?.location || lease?.executionCity || '',
  })
  await triggerPdfDownload(doc, `Deposit Receipt - ${property.name} - ${agreement.tenant_name}.pdf`)
}

/**
 * Receipt for a specific posted rent_transactions row.
 */
export async function downloadRentReceiptPdf(rentTxn, agreement, property) {
  if (!rentTxn) throw new Error('No rent transaction provided — post the payment to the ledger first.')
  const currency = rentTxn.currency || 'INR'
  const lease = currency === 'INR' ? CONFIG.leaseIndia : null
  const purpose = rentTxn.late_fee > 0
    ? `rent and late fee for ${rentTxn.period_month}`
    : `rent for ${rentTxn.period_month}`
  const doc = await buildReceiptPdf({
    property,
    tenantName: agreement?.tenant_name || '[TENANT NAME]',
    tenantAddress: agreement?.tenant_address || '',
    amount: rentTxn.total_due,
    currency,
    paymentDate: rentTxn.paid_date,
    paymentMode: rentTxn._paymentMode || 'Bank Transfer',
    referenceNo: rentTxn._referenceNo || '',
    purpose,
    isDeposit: false,
    lessorName: lease?.lessorName || '[LANDLORD NAME]',
    executionCity: property?.city || property?.location || lease?.executionCity || '',
  })
  await triggerPdfDownload(doc, `Rent Receipt - ${property.name} - ${rentTxn.period_month}.pdf`)
}
