// ============================================================
//  generateLeaseDeed.js
//  Builds the standardized India lease deed (.docx) used for every
//  rentalProperties entry, based on the Tritvam T4-9D agreement
//  (the more complete of two real signed leases compared on
//  2026-06-24 — Pinnacle's older draft was missing the late-fee
//  table, premature-termination tiers, deep-clean clause, and used
//  a different renewal % and maintenance arrangement). Per explicit
//  decision, the late-fee tiers, termination penalties, 7% renewal
//  increase, and maintenance-excluded-from-rent are now FIXED
//  standard terms for every India tenancy — not configurable per
//  agreement — and live in CONFIG.leaseIndia. Only tenant identity,
//  dates, rent, and deposit vary per agreement; only unit/floor/
//  building/parking/electricity vary per property.
// ============================================================
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, TabStopType, TabStopPosition,
} from 'docx'
import { CONFIG } from '../config'
import { parseLocalDate } from './dates'

function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// "1st July 2026" — matches the deed's own date style throughout
function fmtLongDate(dateStr) {
  const d = parseLocalDate(dateStr)
  if (!d) return '[date]'
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${ordinal(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function fmtRupees(n) {
  const v = Math.round(Number(n) || 0)
  return `₹${v.toLocaleString('en-IN')}`
}

function numberToWordsIndian(num) {
  // Minimal Indian-numbering (lakh/crore) word converter — covers the
  // realistic range of rents/deposits (hundreds to a few crore).
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function twoDigit(n) {
    if (n < 20) return ones[n]
    return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '')
  }
  function threeDigit(n) {
    if (n < 100) return twoDigit(n)
    return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + twoDigit(n%100) : '')
  }
  let n = Math.round(Number(num) || 0)
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh  = Math.floor(n / 100000);   n %= 100000
  const thousand = Math.floor(n / 1000);  n %= 1000
  const rest = n
  const parts = []
  if (crore)    parts.push(threeDigit(crore) + ' Crore')
  if (lakh)     parts.push(threeDigit(lakh) + ' Lakh')
  if (thousand) parts.push(threeDigit(thousand) + ' Thousand')
  if (rest)     parts.push(threeDigit(rest))
  return parts.join(' ')
}

function fmtRupeesWords(n) {
  return `Rupees ${numberToWordsIndian(n)} only`
}

// Standard run/paragraph helpers — Arial throughout, matches the
// signed deed's typewriter-adjacent look closely enough while staying
// universally renderable.
const FONT = 'Arial'
function p(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: 200, ...opts.spacing },
    children: Array.isArray(children) ? children : [children],
  })
}
function r(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: 22, bold: !!opts.bold, ...opts })
}
function centerLabel(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [r(text, { bold: true })] })
}
function signatureRow(lessorName, tenantName) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 300, after: 100 },
    children: [
      r('LESSOR', { bold: true }),
      new TextRun({ text: '\tLESSEE', font: FONT, size: 22, bold: true }),
    ],
  })
}
function signatureNames(lessorName, tenantName) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { after: 300 },
    children: [
      r(lessorName.toUpperCase(), { bold: true }),
      new TextRun({ text: `\t${tenantName.toUpperCase() || '[TENANT NAME]'}`, font: FONT, size: 22, bold: true }),
    ],
  })
}

function lateFeeTable(tiers, rentAmount) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const headerRow = new TableRow({
    children: ['Timeline', 'Addl Late Fee', 'Total Net Rent Payable'].map(h =>
      new TableCell({
        borders, width: { size: 3120, type: WidthType.DXA },
        shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({ children: [r(h, { bold: true, size: 18 })] })],
      })
    ),
  })
  const dataRows = tiers.map(t => {
    const total = (Number(rentAmount) || 0) + t.fee
    return new TableRow({
      children: [
        t.label,
        t.fee ? fmtRupees(t.fee) : '—',
        fmtRupees(total),
      ].map((cell, i) => new TableCell({
        borders, width: { size: 3120, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [r(String(cell), { size: 18 })] })],
      })),
    })
  })
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows: [headerRow, ...dataRows],
  })
}

/**
 * Builds the lease deed Document object for a given agreement + property.
 * @param {object} agreement - the saved rental_props row (snake_case fields)
 * @param {object} property  - the matching CONFIG.rentalProperties entry
 * @returns {Document}
 */
export function buildLeaseDeedDocument(agreement, property) {
  const lease = CONFIG.leaseIndia
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

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

  const children = [
    // Title block
    p([
      r('THIS LEASE DEED', { bold: true }),
      r(` is executed at ${lease.executionCity} on the ${fmtLongDate(todayStr)}, BETWEEN Mr. `),
      r(lease.lessorName, { bold: true }),
      r(` ${lease.lessorAddress}. (PAN No - ${lease.lessorPan}) hereinafter referred to as the \u201CLESSOR/ First Party\u201D (which expression shall include his heirs, successors legal representatives and assigns) of the one part.`),
    ]),
    p(r('AND'), { align: AlignmentType.CENTER }),
    p([
      r(`Mr/Mrs. ${tenantName}, ${tenantAddress}. (PAN/Aadhaar No \u2013 ${tenantPan}) hereinafter referred to as \u201CLESSEE/ Second Party\u201D (which expression shall include its heirs, legal representatives and assigns) of the other part.`),
    ]),
    signatureRow(), signatureNames(lease.lessorName, tenantName),

    p([
      r(`WHEREAS the LESSOR is the owner of the ${propertyDesc} has at the request of the LESSEE agreed to lease out the said flat on the following terms and conditions:-`),
    ]),
    p(r('NOW THIS DEED WITNESSES AS FOLLOWS:-', { bold: true })),

    // Clause 1
    p([
      r('1.\u2003The lease is granted for a period of 11 (eleven) months commencing from '),
      r(fmtLongDate(leaseStart), { bold: true }),
      r(' till '),
      r(fmtLongDate(leaseEnd), { bold: true }),
      r(`, and the rent shall be effective from the said date of ${fmtLongDate(leaseStart)}.`),
    ]),
    signatureRow(), signatureNames(lease.lessorName, tenantName),

    // Clause 2 — rent, payment, late fees
    p([
      r(`2.\u2003The LESSEE shall pay to the LESSOR ${fmtRupees(rent)}/- (${fmtRupeesWords(rent)}) `),
      r(maintClause),
      r(` as rent for the ${property.furnishing || 'unfurnished'} residence. Rent should be transferred online to LESSOR Bank Account: Account name ${lease.bank.accountName}, ${lease.bank.bankName}, Account Number \u2013 ${lease.bank.accountNumber} [IFSC: ${lease.bank.ifsc}, SWIFT Code: ${lease.bank.swift}]. Rent is due on the 1st day of every English calendar month, with an emergency grace period until the 5th of the same month. In the event of any default in payment of the rent as stipulated above, late fee will be levied and payable by the LESSEE from the date of default till the date of payment in full, per the table below. If the LESSEE fails to pay the LESSOR the monthly rent consecutively for two months, the agreement will automatically be cancelled, and the LESSEE shall be liable to vacate the premises in line with the clause for premature termination of this agreement.`),
    ]),
    lateFeeTable(lease.lateFeeTiers, rent),
    p('', { spacing: { after: 200 } }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({ children: [
          new TableCell({ borders: { top:{style:BorderStyle.SINGLE,size:1,color:'999999'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'999999'}, left:{style:BorderStyle.SINGLE,size:1,color:'999999'}, right:{style:BorderStyle.SINGLE,size:1,color:'999999'} },
            width: { size: 4680, type: WidthType.DXA }, shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [new Paragraph({ children: [r('Premature Termination', { bold: true, size: 18 })] })] }),
          new TableCell({ borders: { top:{style:BorderStyle.SINGLE,size:1,color:'999999'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'999999'}, left:{style:BorderStyle.SINGLE,size:1,color:'999999'}, right:{style:BorderStyle.SINGLE,size:1,color:'999999'} },
            width: { size: 4680, type: WidthType.DXA }, shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [new Paragraph({ children: [r('Conditions', { bold: true, size: 18 })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: { top:{style:BorderStyle.SINGLE,size:1,color:'999999'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'999999'}, left:{style:BorderStyle.SINGLE,size:1,color:'999999'}, right:{style:BorderStyle.SINGLE,size:1,color:'999999'} },
            width: { size: 4680, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [r('Prior to completing the full 11-month term', { size: 18 })] })] }),
          new TableCell({ borders: { top:{style:BorderStyle.SINGLE,size:1,color:'999999'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'999999'}, left:{style:BorderStyle.SINGLE,size:1,color:'999999'}, right:{style:BorderStyle.SINGLE,size:1,color:'999999'} },
            width: { size: 4680, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [r(lease.prematureTermination.beforeFullTerm, { size: 18 })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: { top:{style:BorderStyle.SINGLE,size:1,color:'999999'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'999999'}, left:{style:BorderStyle.SINGLE,size:1,color:'999999'}, right:{style:BorderStyle.SINGLE,size:1,color:'999999'} },
            width: { size: 4680, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [r('Prior to completing 6 months', { size: 18 })] })] }),
          new TableCell({ borders: { top:{style:BorderStyle.SINGLE,size:1,color:'999999'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'999999'}, left:{style:BorderStyle.SINGLE,size:1,color:'999999'}, right:{style:BorderStyle.SINGLE,size:1,color:'999999'} },
            width: { size: 4680, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [r(`${lease.prematureTermination.before6Months} (${fmtRupees(rent)}/-)`, { size: 18 })] })] }),
        ]}),
      ],
    }),
    p('', { spacing: { after: 200 } }),

    // Clause 3 — deposit
    p([
      r(`3.\u2003The LESSEE has paid ${fmtRupees(deposit)}/- (${fmtRupeesWords(deposit)}) towards an interest free security deposit for the proper maintenance of the residence and for the satisfactory performance of the terms of this deed via online transfer. This amount will be refunded by the LESSOR to the LESSEE without interest as and when the residence is vacated by the LESSEE after adjusting amounts, if any, due from the LESSEE.`),
    ]),

    // Clause 4 — electricity/water/gas
    p([
      r(`4.\u2003In addition to the rent payable as per clause 2) the LESSEE shall be liable to pay, for the duration of the tenancy period, `),
      r(electricityClause),
      r(' in respect of the apartment, and the LESSEE shall submit the payment receipt to the LESSOR on a quarterly basis for perusal.'),
    ]),
    signatureRow(), signatureNames(lease.lessorName, tenantName),

    // Clause 5
    p(r('5.\u2003The LESSEE shall keep the said residence in good condition and shall not sub-let, assign or otherwise part with possession of the same in part or whole. The LESSEE has to abide by the rules and regulations applicable to the LESSEE under respective laws. It is hereby expressly agreed and declared that the LESSEE shall use and occupy the said Flat as LESSEE only and shall not claim any interest in the said premises. The LESSEE shall not claim possession of the said premises or keep any outside party in the said premises or any part thereof, it being clearly understood that the rights are purely, temporarily, personal and on contract basis and are non-transferable; the LESSEE shall not be entitled to transfer the benefit of this agreement to anybody else. The Second Party hereby agrees to preserve the building neat and tidy and fixtures and fittings thereto in good condition and intact, and agrees to return them intact at the expiry/termination of this agreement or if and when it is otherwise revoked. The Second Party agrees that they shall not do any act or activities which are antisocial, obnoxious, illegal, or prejudicial, which may cause nuisance to neighbours or constitute breach of relevant standard rules. The First Party shall not have any liability or obligation in any matter arising due to negligence of the Second Party during its occupancy. The Second Party shall not store or cause to be stored any hazardous, combustible, dangerous, or contraband goods in the scheduled premises. The garbage and domestic waste from the said premises shall be disposed of by the Second Party at their own responsibility and expense, and waste shall not be disposed of within the property.')),

    // Clause 6
    p([
      r('6.\u2003The LESSEE shall, before occupation, make sure that all the sanitary, electrical and other fittings are in good condition and in working order, and shall return them in the same condition at the time of vacating the residence. Please mention anything that needs attention in the move-in checklist within 10 days of possession. Photographs taken at move-in may be used at exit to validate any pre-existing condition.'),
    ]),

    // Clause 7
    p(r('7.\u2003The LESSEE shall use the residence only for residential purposes. The Second Party will not assign or sublease the premises, or use it for purposes other than the aforesaid purpose, without the written consent of the First Party.')),
    signatureRow(), signatureNames(lease.lessorName, tenantName),

    // Clause 8 — termination + renewal
    p([
      r('8.\u2003The Lease agreement shall be terminated prior to the expiry of the present term by either party after giving thirty days\u2019 written notice to the other party. This lease agreement could be renewed after the expiry of the present term by mutual consent for a further period, with the rent amount as per clause 2) increased by '),
      r(`${lease.renewalIncreasePct}%`, { bold: true }),
      r(' as standard rental rent (excluding maintenance).'),
    ]),

    // Clause 9
    p(r('9.\u2003The LESSEE shall not carry out any additions or alterations to the residence, layout of fixtures, fixing of A/C, or additional locks on doors without the written consent of the LESSOR. The LESSEE, at the time of vacating the residence, should remove any nails and screws on walls, doors, and parquet floors, restoring them to the same state as when handed over.')),

    // Clause 10
    p(r('10.\u2003The LESSEE shall permit the LESSOR or their agents to enter the residence with prior intimation, for inspection or to carry out repairs etc., at reasonable times as and when necessary.')),

    // Clause 11
    p(r('11.\u2003The LESSOR shall pay all taxes of any kind whatsoever, including house tax, ground rent, as are or may hereinafter be assessed on the residence by the Corporation or any other authority whatsoever.')),

    // Clause 12
    p(r('12.\u2003The parties shall comply with all the rules and regulations of the local Municipal and other relevant bodies, including the residents\u2019 association.')),

    // Clause 13
    p(r('13.\u2003Day-to-day minor repairs such as replacement of electrical switches, light bulbs/tube lights, fuses, and leakage of water taps etc. must be done by the LESSEE at their own cost and should be handled by competent professionals. Major repairs such as leakage in electrical wiring or bursting of sanitary pipes or cracks shall be borne by the LESSOR at their own cost, provided there is no intentional physical damage or misuse caused by the LESSEE.')),
    p(r('The house is rented with the following appliances: Gas Stove, exhaust hood and fan(s); any repair works required would have to be done by the LESSEE.')),
    signatureRow(), signatureNames(lease.lessorName, tenantName),

    // Clause 14
    p(r('14.\u2003On expiry of the lease period or termination of lease as per clause 8 above, and simultaneous refund of security deposit as well as any unadjusted advance rent paid, the LESSEE shall hand over vacant possession of the residence to the LESSOR in the same condition as at the time of commencement of the lease, normal wear and tear expected.')),

    // Clause 15
    p(r('15.\u2003The LESSEE or anyone living in the premises should not undertake any illegal activities therein. The LESSEE will be fully responsible for such activities and the consequences thereof. The LESSOR absolves himself of all responsibilities for any unlawful activities within the premises during the tenancy period.')),

    // Clause 16
    p(r(`16.\u2003The Second Party alone shall be responsible for all matters related to the apartment and the persons staying there, and the First Party has no responsibility or liability for such matters, nor shall the property be attached in any legal proceeding arising during the tenancy of the Second Party. Details of foreign nationals/expatriates/employees residing in the said building shall be intimated to authorities/police as per rules, by the Second Party themselves. Jurisdiction for legal disputes shall be at the appropriate local court in ${lease.jurisdiction}.`)),
    p(r('Breach of any aforementioned condition by the Second Party will enable the First Party to terminate this agreement and take immediate possession of the property, and to be indemnified for losses by the Second Party and its assets for any damages inflicted.')),
    p(r('If court action is sought by either party to enforce the provisions of this agreement, including abandonment of the residence/premises for 15 days without paying rent in advance for that month, or while owing any back rent from previous months, the attorney\u2019s fees and costs may be awarded to the prevailing party in the court action.')),

    // Clause 17
    p([
      r(`17.\u2003The LESSEE acknowledges that the said property is in good condition. If there is anything about the condition of the property that is not good, they agree to report it to the LESSOR in writing within ${lease.defectNoticeDays} days of taking possession of the property. Failure to file any such written notice will be legally binding proof that the property was in good condition at the time of occupancy. The LESSEE will have the flat professionally deep-cleaned at move-out (or request the LESSOR to arrange this and deduct the cost from the deposit).`),
    ]),

    new Paragraph({ spacing: { before: 400, after: 100 }, children: [new TextRun({ text: '', font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 300 }, children: [r('WITNESSES', { bold: true })] }),
    p(r('1.')),
    p(r('2.')),
    signatureRow(), signatureNames(lease.lessorName, tenantName),
  ]

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  })
}

/**
 * Generates and triggers a browser download of the lease deed for the
 * given agreement + property. Validates required fields first and
 * throws a descriptive error if anything essential is missing, rather
 * than silently producing a deed full of [TENANT NAME]-style placeholders.
 */
export async function downloadLeaseDeed(agreement, property) {
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

  const doc = buildLeaseDeedDocument(agreement, property)
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Lease Deed - ${property.name} - ${agreement.tenant_name}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
