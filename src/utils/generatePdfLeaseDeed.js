// ============================================================
//  generatePdfLeaseDeed.js
//  PDF version of generateLeaseDeed.js — the full multi-clause India
//  lease deed. Faithfully ported clause-by-clause from the docx
//  version (same legal text, same structure) rather than rewritten,
//  given the stakes of subtly altering legal wording during a format
//  port. The lessor's signature image is embedded once, at the final
//  WITNESSES section, above the printed LESSOR name (per explicit
//  decision, 2026-06-28) — the mid-document LESSOR/LESSEE name pairs
//  after clauses 1/2/4/7/13 stay as plain printed names (matching the
//  docx version exactly), since those are meant for wet-ink initialing
//  on a printed copy, not a baked-in signature image repeated 6 times.
// ============================================================
import { CONFIG } from '../config'
import { createPdfWithCursor, triggerPdfDownload, fmtLongDate } from './pdfGenHelpers'
import { rgb } from 'pdf-lib'

function fmtRupees(n) {
  const v = Math.round(Number(n) || 0)
  return `\u20b9${v.toLocaleString('en-IN')}`
}

function numberToWordsIndian(num) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function twoDigit(n) {
    if (n < 20) return ones[n]
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  }
  function threeDigit(n) {
    if (n < 100) return twoDigit(n)
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigit(n % 100) : '')
  }
  let n = Math.round(Number(num) || 0)
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh = Math.floor(n / 100000); n %= 100000
  const thousand = Math.floor(n / 1000); n %= 1000
  const rest = n
  const parts = []
  if (crore) parts.push(threeDigit(crore) + ' Crore')
  if (lakh) parts.push(threeDigit(lakh) + ' Lakh')
  if (thousand) parts.push(threeDigit(thousand) + ' Thousand')
  if (rest) parts.push(threeDigit(rest))
  return parts.join(' ')
}

function fmtRupeesWords(n) { return `Rupees ${numberToWordsIndian(n)} only` }

function drawSignatureNamesRow(cursor, lessorName, tenantName) {
  cursor.moveDown(6)
  const halfWidth = cursor.contentWidth / 2
  cursor.page.drawText('LESSOR', { x: cursor.x, y: cursor.y, size: 9, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.page.drawText('LESSEE', { x: cursor.x + halfWidth, y: cursor.y, size: 9, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.moveDown(12)
  cursor.page.drawText((lessorName || '[LESSOR]').toUpperCase(), { x: cursor.x, y: cursor.y, size: 9, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.page.drawText((tenantName || '[TENANT NAME]').toUpperCase(), { x: cursor.x + halfWidth, y: cursor.y, size: 9, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.moveDown(16)
}

function drawLateFeeTable(cursor, tiers, rentAmount) {
  const widths = [166, 166, 166]
  const headerHeight = 18
  const rowHeight = 16
  const fontSize = 8
  const totalWidth = widths.reduce((a,b)=>a+b,0)
  cursor.ensureSpace(headerHeight + rowHeight * tiers.length)
  const tableTop = cursor.y
  cursor.page.drawRectangle({ x: cursor.x, y: cursor.y - headerHeight, width: totalWidth, height: headerHeight, color: rgb(0.91,0.91,0.91) })
  let colX = cursor.x
  ;['Timeline', 'Addl Late Fee', 'Total Net Rent Payable'].forEach((h,i) => {
    cursor.page.drawText(h, { x: colX + 3, y: cursor.y - headerHeight + 5, size: fontSize, font: cursor.fonts.bold, color: rgb(0,0,0) })
    colX += widths[i]
  })
  cursor.moveDown(headerHeight)
  tiers.forEach(t => {
    const total = (Number(rentAmount) || 0) + t.fee
    const cells = [t.label, t.fee ? fmtRupees(t.fee) : '\u2014', fmtRupees(total)]
    let cx = cursor.x
    cells.forEach((cell, i) => {
      const font = cursor.fonts.regular
      const text = String(cell)
      const w = font.widthOfTextAtSize(text, fontSize)
      const x = i === 0 ? cx + 3 : cx + widths[i] - w - 3
      cursor.page.drawText(text, { x, y: cursor.y - rowHeight + 5, size: fontSize, font, color: rgb(0,0,0) })
      cx += widths[i]
    })
    cursor.moveDown(rowHeight)
  })
  const tableBottom = cursor.y
  cursor.page.drawRectangle({ x: cursor.x, y: tableBottom, width: totalWidth, height: tableTop - tableBottom, borderColor: rgb(0.6,0.6,0.6), borderWidth: 0.75, color: undefined })
  let sepX = cursor.x
  widths.forEach((w,i) => { if (i>0) cursor.page.drawLine({ start:{x:sepX,y:tableTop}, end:{x:sepX,y:tableBottom}, thickness:0.75, color:rgb(0.6,0.6,0.6) }); sepX += w })
  let sepY = tableTop - headerHeight
  for (let i=0;i<tiers.length-1;i++) { sepY -= rowHeight; cursor.page.drawLine({ start:{x:cursor.x,y:sepY}, end:{x:cursor.x+totalWidth,y:sepY}, thickness:0.4, color:rgb(0.8,0.8,0.8) }) }
  cursor.moveDown(10)
}

function drawWrappedCell(cursor, text, x, y, maxWidth, fontSize) {
  const font = cursor.fonts.regular
  const words = String(text).split(' ')
  let line = '', lineY = y
  words.forEach((word) => {
    const test = line ? line + ' ' + word : word
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
      cursor.page.drawText(line, { x, y: lineY, size: fontSize, font, color: rgb(0,0,0) })
      line = word
      lineY -= fontSize + 2
    } else {
      line = test
    }
  })
  if (line) cursor.page.drawText(line, { x, y: lineY, size: fontSize, font, color: rgb(0,0,0) })
}

function drawTerminationTable(cursor, lease, rent) {
  const widths = [249, 249]
  const headerHeight = 16
  const rowHeight = 24
  const fontSize = 8
  const totalWidth = widths.reduce((a,b)=>a+b,0)
  const rows = [
    ['Prior to completing the full 11-month term', lease.prematureTermination.beforeFullTerm],
    ['Prior to completing 6 months', `${lease.prematureTermination.before6Months} (${fmtRupees(rent)}/-)`],
  ]
  cursor.ensureSpace(headerHeight + rowHeight * rows.length)
  const tableTop = cursor.y
  cursor.page.drawRectangle({ x: cursor.x, y: cursor.y - headerHeight, width: totalWidth, height: headerHeight, color: rgb(0.91,0.91,0.91) })
  cursor.page.drawText('Premature Termination', { x: cursor.x + 3, y: cursor.y - headerHeight + 4, size: fontSize, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.page.drawText('Conditions', { x: cursor.x + widths[0] + 3, y: cursor.y - headerHeight + 4, size: fontSize, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.moveDown(headerHeight)
  rows.forEach(([label, cond]) => {
    cursor.ensureSpace(rowHeight)
    drawWrappedCell(cursor, label, cursor.x + 3, cursor.y - 10, widths[0] - 6, fontSize)
    drawWrappedCell(cursor, cond, cursor.x + widths[0] + 3, cursor.y - 10, widths[1] - 6, fontSize)
    cursor.moveDown(rowHeight)
  })
  const tableBottom = cursor.y
  cursor.page.drawRectangle({ x: cursor.x, y: tableBottom, width: totalWidth, height: tableTop - tableBottom, borderColor: rgb(0.6,0.6,0.6), borderWidth: 0.75, color: undefined })
  cursor.page.drawLine({ start:{x:cursor.x+widths[0],y:tableTop}, end:{x:cursor.x+widths[0],y:tableBottom}, thickness:0.75, color:rgb(0.6,0.6,0.6) })
  cursor.page.drawLine({ start:{x:cursor.x,y:tableTop-headerHeight-rowHeight}, end:{x:cursor.x+totalWidth,y:tableTop-headerHeight-rowHeight}, thickness:0.4, color:rgb(0.8,0.8,0.8) })
  cursor.moveDown(12)
}

export async function buildLeaseDeedPdf(agreement, property) {
  const lease = CONFIG.leaseIndia
  const { doc, cursor } = await createPdfWithCursor()
  const todayStr = new Date().toISOString().slice(0, 10)

  const tenantName    = agreement.tenant_name || '[TENANT NAME]'
  const tenantAddress = agreement.tenant_address || '[TENANT ADDRESS]'
  const tenantPan     = agreement.tenant_pan || '[PAN/AADHAAR]'
  const leaseStart    = agreement.lease_start
  const leaseEnd      = agreement.lease_end
  const rent          = Number(agreement.agreed_rent) || 0
  const deposit       = Number(agreement.deposit) || 0

  const propertyDesc = [
    property.unitNo ? `Flat No ${property.unitNo}` : null,
    property.floor ? `in the ${property.floor} floor` : null,
    property.hasParking ? '(with covered car parking space)' : null,
    `at ${property.building}${property.city ? ', ' + property.city : ''}`,
  ].filter(Boolean).join(' ')

  const maintClause = lease.maintenanceIncludedInRent
    ? 'plus monthly maintenance, which is included in the rent stated above and shall be paid by the LESSOR'
    : 'plus monthly maintenance (based on current ongoing association charges), payable separately by the LESSEE directly to the property management office'

  const electricityClause = property.electricityConsumerNo
    ? `the Electricity charges of Consumer No \u2013 ${property.electricityConsumerNo} including advance deposits for KSEB, Water Charges and Gas Charges`
    : 'the Electricity charges including advance deposits for KSEB, Water Charges and Gas Charges'

  const SZ = 9

  cursor.drawRuns([
    { text: 'THIS LEASE DEED', bold: true },
    { text: ` is executed at ${lease.executionCity} on the ${fmtLongDate(todayStr)}, BETWEEN Mr. ` },
    { text: lease.lessorName, bold: true },
    { text: ` ${lease.lessorAddress}. (PAN No - ${lease.lessorPan}) hereinafter referred to as the \u201CLESSOR/ First Party\u201D (which expression shall include his heirs, successors legal representatives and assigns) of the one part.` },
  ], { size: SZ, spacingAfter: 6 })
  cursor.drawLine('AND', { size: SZ, align: 'center', spacingAfter: 6 })
  cursor.drawRuns([
    { text: `Mr/Mrs. ${tenantName}, ${tenantAddress}. (PAN/Aadhaar No \u2013 ${tenantPan}) hereinafter referred to as \u201CLESSEE/ Second Party\u201D (which expression shall include its heirs, legal representatives and assigns) of the other part.` },
  ], { size: SZ, spacingAfter: 4 })
  drawSignatureNamesRow(cursor, lease.lessorName, tenantName)

  cursor.drawRuns([
    { text: `WHEREAS the LESSOR is the owner of the ${propertyDesc} has at the request of the LESSEE agreed to lease out the said flat on the following terms and conditions:-` },
  ], { size: SZ, spacingAfter: 6 })
  cursor.drawLine('NOW THIS DEED WITNESSES AS FOLLOWS:-', { size: SZ, bold: true, spacingAfter: 8 })

  cursor.drawRuns([
    { text: '1.\u2003The lease is granted for a period of 11 (eleven) months commencing from ' },
    { text: fmtLongDate(leaseStart), bold: true },
    { text: ' till ' },
    { text: fmtLongDate(leaseEnd), bold: true },
    { text: `, and the rent shall be effective from the said date of ${fmtLongDate(leaseStart)}.` },
  ], { size: SZ, spacingAfter: 4 })
  drawSignatureNamesRow(cursor, lease.lessorName, tenantName)

  cursor.drawRuns([
    { text: `2.\u2003The LESSEE shall pay to the LESSOR ${fmtRupees(rent)}/- (${fmtRupeesWords(rent)}) ` },
    { text: maintClause },
    { text: ` as rent for the ${property.furnishing || 'unfurnished'} residence. Rent should be transferred online to LESSOR Bank Account: Account name ${lease.bank.accountName}, ${lease.bank.bankName}, Account Number \u2013 ${lease.bank.accountNumber} [IFSC: ${lease.bank.ifsc}, SWIFT Code: ${lease.bank.swift}]. Rent is due on the 1st day of every English calendar month, with an emergency grace period until the 5th of the same month. In the event of any default in payment of the rent as stipulated above, late fee will be levied and payable by the LESSEE from the date of default till the date of payment in full, per the table below. If the LESSEE fails to pay the LESSOR the monthly rent consecutively for two months, the agreement will automatically be cancelled, and the LESSEE shall be liable to vacate the premises in line with the clause for premature termination of this agreement.` },
  ], { size: SZ, spacingAfter: 6 })
  drawLateFeeTable(cursor, lease.lateFeeTiers, rent)
  drawTerminationTable(cursor, lease, rent)

  cursor.drawRuns([
    { text: `3.\u2003The LESSEE has paid ${fmtRupees(deposit)}/- (${fmtRupeesWords(deposit)}) towards an interest free security deposit for the proper maintenance of the residence and for the satisfactory performance of the terms of this deed via online transfer. This amount will be refunded by the LESSOR to the LESSEE without interest as and when the residence is vacated by the LESSEE after adjusting amounts, if any, due from the LESSEE.` },
  ], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([
    { text: `4.\u2003In addition to the rent payable as per clause 2) the LESSEE shall be liable to pay, for the duration of the tenancy period, ` },
    { text: electricityClause },
    { text: ' in respect of the apartment, and the LESSEE shall submit the payment receipt to the LESSOR on a quarterly basis for perusal.' },
  ], { size: SZ, spacingAfter: 4 })
  drawSignatureNamesRow(cursor, lease.lessorName, tenantName)

  if (agreement.has_separate_parking) {
    cursor.drawRuns([{ text: '4A. Car parking is not included in this lease. The above rent covers the residential flat only. Should the LESSEE require a car parking space, it is available on request at an additional charge, subject to availability, and will be governed by a separate agreement between the parties.' }], { size: SZ, spacingAfter: 6 })
  }

  cursor.drawRuns([{ text: '5.\u2003The LESSEE shall keep the said residence in good condition and shall not sub-let, assign or otherwise part with possession of the same in part or whole. The LESSEE has to abide by the rules and regulations applicable to the LESSEE under respective laws. It is hereby expressly agreed and declared that the LESSEE shall use and occupy the said Flat as LESSEE only and shall not claim any interest in the said premises. The LESSEE shall not claim possession of the said premises or keep any outside party in the said premises or any part thereof, it being clearly understood that the rights are purely, temporarily, personal and on contract basis and are non-transferable; the LESSEE shall not be entitled to transfer the benefit of this agreement to anybody else. The Second Party hereby agrees to preserve the building neat and tidy and fixtures and fittings thereto in good condition and intact, and agrees to return them intact at the expiry/termination of this agreement or if and when it is otherwise revoked. The Second Party agrees that they shall not do any act or activities which are antisocial, obnoxious, illegal, or prejudicial, which may cause nuisance to neighbours or constitute breach of relevant standard rules. The First Party shall not have any liability or obligation in any matter arising due to negligence of the Second Party during its occupancy. The Second Party shall not store or cause to be stored any hazardous, combustible, dangerous, or contraband goods in the scheduled premises. The garbage and domestic waste from the said premises shall be disposed of by the Second Party at their own responsibility and expense, and waste shall not be disposed of within the property.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: '6.\u2003The LESSEE shall, before occupation, make sure that all the sanitary, electrical and other fittings are in good condition and in working order, and shall return them in the same condition at the time of vacating the residence. Please mention anything that needs attention in the move-in checklist within 10 days of possession. Photographs taken at move-in may be used at exit to validate any pre-existing condition.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: '7.\u2003The LESSEE shall use the residence only for residential purposes. The Second Party will not assign or sublease the premises, or use it for purposes other than the aforesaid purpose, without the written consent of the First Party.' }], { size: SZ, spacingAfter: 4 })
  drawSignatureNamesRow(cursor, lease.lessorName, tenantName)

  cursor.drawRuns([
    { text: '8.\u2003The Lease agreement shall be terminated prior to the expiry of the present term by either party after giving thirty days\u2019 written notice to the other party. This lease agreement could be renewed after the expiry of the present term by mutual consent for a further period, with the rent amount as per clause 2) increased by ' },
    { text: `${lease.renewalIncreasePct}%`, bold: true },
    { text: ' as standard rental rent (excluding maintenance).' },
  ], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: '9.\u2003The LESSEE shall not carry out any additions or alterations to the residence, layout of fixtures, fixing of A/C, or additional locks on doors without the written consent of the LESSOR. The LESSEE, at the time of vacating the residence, should remove any nails and screws on walls, doors, and parquet floors, restoring them to the same state as when handed over.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: '10.\u2003The LESSEE shall permit the LESSOR or their agents to enter the residence with prior intimation, for inspection or to carry out repairs etc., at reasonable times as and when necessary.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: '11.\u2003The LESSOR shall pay all taxes of any kind whatsoever, including house tax, ground rent, as are or may hereinafter be assessed on the residence by the Corporation or any other authority whatsoever.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: '12.\u2003The parties shall comply with all the rules and regulations of the local Municipal and other relevant bodies, including the residents\u2019 association.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: '13.\u2003Day-to-day minor repairs such as replacement of electrical switches, light bulbs/tube lights, fuses, and leakage of water taps etc. must be done by the LESSEE at their own cost and should be handled by competent professionals. Major repairs such as leakage in electrical wiring or bursting of sanitary pipes or cracks shall be borne by the LESSOR at their own cost, provided there is no intentional physical damage or misuse caused by the LESSEE.' }], { size: SZ, spacingAfter: 4 })
  cursor.drawRuns([{ text: 'The house is rented with the following appliances: Gas Stove, exhaust hood and fan(s); any repair works required would have to be done by the LESSEE.' }], { size: SZ, spacingAfter: 4 })
  drawSignatureNamesRow(cursor, lease.lessorName, tenantName)

  cursor.drawRuns([{ text: '14.\u2003On expiry of the lease period or termination of lease as per clause 8 above, and simultaneous refund of security deposit as well as any unadjusted advance rent paid, the LESSEE shall hand over vacant possession of the residence to the LESSOR in the same condition as at the time of commencement of the lease, normal wear and tear expected.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: '15.\u2003The LESSEE or anyone living in the premises should not undertake any illegal activities therein. The LESSEE will be fully responsible for such activities and the consequences thereof. The LESSOR absolves himself of all responsibilities for any unlawful activities within the premises during the tenancy period.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([{ text: `16.\u2003The Second Party alone shall be responsible for all matters related to the apartment and the persons staying there, and the First Party has no responsibility or liability for such matters, nor shall the property be attached in any legal proceeding arising during the tenancy of the Second Party. Details of foreign nationals/expatriates/employees residing in the said building shall be intimated to authorities/police as per rules, by the Second Party themselves. Jurisdiction for legal disputes shall be at the appropriate local court in ${lease.jurisdiction}.` }], { size: SZ, spacingAfter: 4 })
  cursor.drawRuns([{ text: 'Breach of any aforementioned condition by the Second Party will enable the First Party to terminate this agreement and take immediate possession of the property, and to be indemnified for losses by the Second Party and its assets for any damages inflicted.' }], { size: SZ, spacingAfter: 4 })
  cursor.drawRuns([{ text: 'If court action is sought by either party to enforce the provisions of this agreement, including abandonment of the residence/premises for 15 days without paying rent in advance for that month, or while owing any back rent from previous months, the attorney\u2019s fees and costs may be awarded to the prevailing party in the court action.' }], { size: SZ, spacingAfter: 6 })

  cursor.drawRuns([
    { text: `17.\u2003The LESSEE acknowledges that the said property is in good condition. If there is anything about the condition of the property that is not good, they agree to report it to the LESSOR in writing within ${lease.defectNoticeDays} days of taking possession of the property. Failure to file any such written notice will be legally binding proof that the property was in good condition at the time of occupancy. The LESSEE will have the flat professionally deep-cleaned at move-out (or request the LESSOR to arrange this and deduct the cost from the deposit).` },
  ], { size: SZ, spacingAfter: 14 })

  cursor.drawLine('WITNESSES', { size: SZ, bold: true, spacingAfter: 8 })
  cursor.drawLine('1.', { size: SZ, spacingAfter: 4 })
  cursor.drawLine('2.', { size: SZ, spacingAfter: 10 })

  await drawFinalSignatureRow(cursor, lease.lessorName, tenantName)

  return doc
}

let _leaseDeedSigCache = null
async function fetchLeaseDeedSignature() {
  if (_leaseDeedSigCache) return _leaseDeedSigCache
  try {
    const res = await fetch('/icons/signature.png')
    if (!res.ok) return null
    _leaseDeedSigCache = new Uint8Array(await res.arrayBuffer())
    return _leaseDeedSigCache
  } catch (e) { console.warn('Could not load signature image:', e); return null }
}

async function drawFinalSignatureRow(cursor, lessorName, tenantName) {
  const sigBytes = await fetchLeaseDeedSignature()
  const sigHeight = 28
  const halfWidth = cursor.contentWidth / 2
  cursor.ensureSpace(sigHeight + 30)
  if (sigBytes) {
    const img = await cursor.doc.embedPng(sigBytes)
    const scale = sigHeight / img.height
    cursor.page.drawImage(img, { x: cursor.x, y: cursor.y - sigHeight, width: img.width * scale, height: sigHeight })
  }
  cursor.moveDown(sigHeight + 4)
  cursor.page.drawText('LESSOR', { x: cursor.x, y: cursor.y, size: 9, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.page.drawText('LESSEE', { x: cursor.x + halfWidth, y: cursor.y, size: 9, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.moveDown(12)
  cursor.page.drawText((lessorName || '[LESSOR]').toUpperCase(), { x: cursor.x, y: cursor.y, size: 9, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.page.drawText((tenantName || '[TENANT NAME]').toUpperCase(), { x: cursor.x + halfWidth, y: cursor.y, size: 9, font: cursor.fonts.bold, color: rgb(0,0,0) })
  cursor.moveDown(14)
}

export async function downloadLeaseDeedPdf(agreement, property) {
  const missing = []
  if (!agreement.tenant_name)    missing.push('Tenant name')
  if (!agreement.tenant_address) missing.push('Tenant address')
  if (!agreement.tenant_pan)     missing.push('Tenant PAN/Aadhaar')
  if (!agreement.lease_start)    missing.push('Lease start date')
  if (!agreement.lease_end)      missing.push('Lease end date')
  if (!agreement.agreed_rent)    missing.push('Monthly rent')
  if (!agreement.deposit)        missing.push('Security deposit')
  if (missing.length) {
    throw new Error(`Cannot generate lease deed — missing: ${missing.join(', ')}. Fill these in and save first.`)
  }
  const doc = await buildLeaseDeedPdf(agreement, property)
  await triggerPdfDownload(doc, `Lease Deed - ${property.name} - ${agreement.tenant_name}.pdf`)
}
