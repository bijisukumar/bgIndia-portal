// ============================================================
//  generatePdfMoveReport.js
//  PDF version of generateMoveReport.js — Move-In/Move-Out Inspection
//  Report, with the lessor's signature image baked in above the
//  printed name on the signature block (per explicit decision,
//  2026-06-28). Move-in documents additionally get the IMPORTANT
//  TERMS & CONDITIONS section (14-day reporting window, rent/payment
//  terms, move-out obligations) — never shown on move-out, same
//  reasoning as the docx version: that legal effect only makes sense
//  stated AT move-in.
// ============================================================
import { localTodayStr } from './dates'
import { createPdfWithCursor, triggerPdfDownload, fmtLongDate } from './pdfGenHelpers'
import { rgb } from 'pdf-lib'

const DEFAULT_ROOMS = [
  'Living Room', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bathroom 1', 'Bathroom 2',
  'Balcony / Utility', 'Doors & Windows', 'Electrical Fixtures & Switches',
  'Plumbing & Fixtures', 'Walls & Paint', 'Flooring',
]

function drawChecklistTable(cursor, rooms) {
  const widths = [180, 100, 218]
  const headerHeight = 18
  const rowHeight = 16
  const fontSize = 8.5
  const totalWidth = widths.reduce((a,b) => a+b, 0)
  cursor.ensureSpace(headerHeight + rowHeight * rooms.length)

  const tableTop = cursor.y
  cursor.page.drawRectangle({ x: cursor.x, y: cursor.y - headerHeight, width: totalWidth, height: headerHeight, color: rgb(0.91,0.91,0.91) })
  let colX = cursor.x
  ;['Item / Area', 'Condition', 'Notes'].forEach((label, i) => {
    cursor.page.drawText(label, { x: colX + 4, y: cursor.y - headerHeight + 5, size: fontSize, font: cursor.fonts.bold, color: rgb(0,0,0) })
    colX += widths[i]
  })
  cursor.moveDown(headerHeight)

  rooms.forEach(room => {
    cursor.page.drawText(room, { x: cursor.x + 4, y: cursor.y - rowHeight + 5, size: fontSize, font: cursor.fonts.regular, color: rgb(0,0,0) })
    cursor.moveDown(rowHeight)
  })

  const tableBottom = cursor.y
  const totalHeight = tableTop - tableBottom
  cursor.page.drawRectangle({ x: cursor.x, y: tableBottom, width: totalWidth, height: totalHeight, borderColor: rgb(0.6,0.6,0.6), borderWidth: 0.75, color: undefined })
  let sepX = cursor.x
  widths.forEach((w, i) => {
    if (i > 0) cursor.page.drawLine({ start: { x: sepX, y: tableTop }, end: { x: sepX, y: tableBottom }, thickness: 0.75, color: rgb(0.6,0.6,0.6) })
    sepX += w
  })
  let sepY = tableTop - headerHeight
  for (let i = 0; i < rooms.length - 1; i++) {
    sepY -= rowHeight
    cursor.page.drawLine({ start: { x: cursor.x, y: sepY }, end: { x: cursor.x + totalWidth, y: sepY }, thickness: 0.4, color: rgb(0.8,0.8,0.8) })
  }
  cursor.moveDown(10)
}

function drawMeterTable(cursor) {
  const widths = [240, 258]
  const rowHeight = 16
  const fontSize = 8.5
  const totalWidth = widths.reduce((a,b)=>a+b,0)
  const rows = ['Electricity Meter Reading', 'Water Meter Reading (if applicable)', 'Number of Keys Handed Over']
  cursor.ensureSpace(rowHeight * rows.length)
  const tableTop = cursor.y
  rows.forEach(label => {
    cursor.page.drawText(label, { x: cursor.x + 4, y: cursor.y - rowHeight + 5, size: fontSize, font: cursor.fonts.bold, color: rgb(0,0,0) })
    cursor.moveDown(rowHeight)
  })
  const tableBottom = cursor.y
  cursor.page.drawRectangle({ x: cursor.x, y: tableBottom, width: totalWidth, height: tableTop - tableBottom, borderColor: rgb(0.6,0.6,0.6), borderWidth: 0.75, color: undefined })
  cursor.page.drawLine({ start: { x: cursor.x + widths[0], y: tableTop }, end: { x: cursor.x + widths[0], y: tableBottom }, thickness: 0.75, color: rgb(0.6,0.6,0.6) })
  let sepY = tableTop
  for (let i = 0; i < rows.length - 1; i++) {
    sepY -= rowHeight
    cursor.page.drawLine({ start: { x: cursor.x, y: sepY }, end: { x: cursor.x + totalWidth, y: sepY }, thickness: 0.4, color: rgb(0.8,0.8,0.8) })
  }
  cursor.moveDown(12)
}

function drawTermsAndConditions(cursor) {
  cursor.moveDown(4)
  cursor.drawLine('IMPORTANT TERMS & CONDITIONS', { size: 11, bold: true, align: 'center', spacingAfter: 8 })

  const items = [
    ['Reporting Window: ', 'This Move-In Inspection Report must be reviewed and returned within ', 'fourteen (14) days', ' of the move-in date stated above. Any defect, damage, or issue not explicitly noted in the table above within this period shall be deemed confirmed as being in good, working condition at the time of move-in, and the tenant accepts the property on that basis.'],
    ['Property Condition: ', 'By signing below, both parties agree that all unlisted items and areas are confirmed to be in good, working condition. Any existing defects must be explicitly noted in the table above.'],
    ['Rent Payment & Due Dates: ', 'Rent is due on the 1st of every month. Payments made between the 2nd and 5th of the month are considered late, but no late fees or penalties will apply during this grace period.'],
    ['Payment Channels: ', 'Monthly rent is to be paid via Google Pay (GPay) or directly to the Owner\u2019s bank account. Maintenance fees are to be paid directly at the Pinnacle management office.'],
    ['Move-Out Obligations: ', 'Upon ending the lease, the tenant must return the flat in the same condition it was received. This includes ensuring all walls are painted back to the original color/specification, all broken items are repaired, and the flat is handed over clean and completely free of trash or garbage.'],
  ]

  items.forEach(parts => {
    const runs = [{ text: parts[0], bold: true }]
    if (parts.length === 4) {
      runs.push({ text: parts[1] }, { text: parts[2], bold: true }, { text: parts[3] })
    } else {
      runs.push({ text: parts[1] })
    }
    cursor.drawRuns(runs, { size: 8, lineGap: 2, spacingAfter: 6 })
  })
}

let _moveReportSigCache = null
async function fetchLocalSignature() {
  if (_moveReportSigCache) return _moveReportSigCache
  try {
    const res = await fetch('/icons/signature.png')
    if (!res.ok) return null
    _moveReportSigCache = new Uint8Array(await res.arrayBuffer())
    return _moveReportSigCache
  } catch (e) { console.warn('Could not load signature image:', e); return null }
}

async function drawSignatureBlockTwoCol(cursor) {
  const sigBytes = await fetchLocalSignature()
  const sigHeight = 26
  const halfWidth = cursor.contentWidth / 2
  cursor.moveDown(6)
  cursor.ensureSpace(sigHeight + 20)
  if (sigBytes) {
    const img = await cursor.doc.embedPng(sigBytes)
    const scale = sigHeight / img.height
    cursor.page.drawImage(img, { x: cursor.x, y: cursor.y - sigHeight, width: img.width * scale, height: sigHeight })
  }
  cursor.moveDown(sigHeight + 4)
  cursor.page.drawLine({ start: { x: cursor.x, y: cursor.y }, end: { x: cursor.x + halfWidth - 20, y: cursor.y }, thickness: 0.75, color: rgb(0.4,0.4,0.4) })
  cursor.page.drawLine({ start: { x: cursor.x + halfWidth, y: cursor.y }, end: { x: cursor.x + cursor.contentWidth, y: cursor.y }, thickness: 0.75, color: rgb(0.4,0.4,0.4) })
  cursor.moveDown(10)
  cursor.drawTwoCol('Signature & Date', 'Signature & Date', { size: 8, spacingAfter: 4 })
}

async function buildMoveReportPdf({ kind, property, tenantName, eventDate, rooms }) {
  const { doc, cursor } = await createPdfWithCursor()
  const title = kind === 'move-out' ? 'MOVE-OUT INSPECTION REPORT' : 'MOVE-IN INSPECTION REPORT'
  const propLabel = property?.fullAddress || (property?.building
    ? `${property.building}${property.unitNo ? ', Unit ' + property.unitNo : ''}, ${property.city || property.location || ''}`
    : (property?.name || '[PROPERTY]'))

  cursor.drawLine(title, { size: 16, bold: true, align: 'center', spacingAfter: 12 })
  cursor.drawRuns([{ text: 'Property: ', bold: true }, { text: propLabel }], { size: 10, spacingAfter: 4 })
  cursor.drawRuns([{ text: 'Tenant: ', bold: true }, { text: tenantName || '[TENANT NAME]' }], { size: 10, spacingAfter: 4 })
  cursor.drawRuns([{ text: `${kind === 'move-out' ? 'Move-Out' : 'Move-In'} Date: `, bold: true }, { text: fmtLongDate(eventDate) }], { size: 10, spacingAfter: 14 })

  cursor.drawRuns([{ text: `This report records the condition of the property and its fixtures at the time of ${kind === 'move-out' ? 'move-out' : 'move-in'}. Both parties should review and initial each section before signing below.` }], { size: 9, spacingAfter: 10 })

  drawChecklistTable(cursor, rooms)
  drawMeterTable(cursor)

  cursor.drawTwoCol('LANDLORD / REPRESENTATIVE', 'TENANT', { bold: true, size: 10, spacingAfter: 2 })
  await drawSignatureBlockTwoCol(cursor)

  if (kind === 'move-in') drawTermsAndConditions(cursor)

  return doc
}

/**
 * @param {'move-in'|'move-out'} kind
 */
export async function downloadMoveReportPdf(kind, agreement, property, eventDate) {
  if (!agreement?.tenant_name) {
    throw new Error('Cannot generate move report — tenant name is required. Fill this in and save first.')
  }
  const doc = await buildMoveReportPdf({
    kind, property, tenantName: agreement.tenant_name,
    eventDate: eventDate || localTodayStr(), rooms: DEFAULT_ROOMS,
  })
  const label = kind === 'move-out' ? 'Move-Out Report' : 'Move-In Report'
  await triggerPdfDownload(doc, `${label} - ${property.name} - ${agreement.tenant_name}.pdf`)
}
