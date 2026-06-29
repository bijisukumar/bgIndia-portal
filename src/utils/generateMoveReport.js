// ============================================================
//  generateMoveReport.js
//  Generates a "Move-In Inspection Report" or "Move-Out Inspection
//  Report" .docx — a condition/inventory checklist for the property,
//  pre-populated with property + tenant context, with a fixed set of
//  rooms/items and blank columns for condition + notes to be filled
//  in by hand (printed) or noted before signing.
//
//  Per the spec: paired with a drag-and-drop file target box in the
//  UI for photo evidence — that upload target lives in the React
//  component (MoveInOutCard), not in this generator. This file only
//  produces the printable inspection form itself.
// ============================================================
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
} from 'docx'
import { localTodayStr } from './dates'
import { fmtLongDate, p, r, centerLabel, twoColRow, FONT } from './docGenHelpers'

const DEFAULT_ROOMS = [
  'Living Room', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bathroom 1', 'Bathroom 2',
  'Balcony / Utility', 'Doors & Windows', 'Electrical Fixtures & Switches',
  'Plumbing & Fixtures', 'Walls & Paint', 'Flooring',
]

function checklistTable(rooms) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const widths = [3200, 1800, 4360] // Item | Condition | Notes
  const headerRow = new TableRow({
    children: ['Item / Area', 'Condition', 'Notes'].map((h, i) =>
      new TableCell({
        borders, width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({ children: [r(h, { bold: true, size: 18 })] })],
      })
    ),
  })
  const dataRows = rooms.map(room =>
    new TableRow({
      children: [room, '', ''].map((cell, i) =>
        new TableCell({
          borders, width: { size: widths[i], type: WidthType.DXA },
          margins: { top: 70, bottom: 70, left: 100, right: 100 },
          children: [new Paragraph({ children: [r(String(cell), { size: 18 })] })],
        })
      ),
    })
  )
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  })
}

function meterReadingsTable() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const widths = [4680, 4680]
  const rows = [
    ['Electricity Meter Reading', ''],
    ['Water Meter Reading (if applicable)', ''],
    ['Number of Keys Handed Over', ''],
  ]
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(([label, val]) =>
      new TableRow({
        children: [label, val].map((cell, i) =>
          new TableCell({
            borders, width: { size: widths[i], type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [r(String(cell), { size: 18, bold: i === 0 })] })],
          })
        ),
      })
    ),
  })
}

function termsAndConditionsSection() {
  // Per explicit decision (2026-06-27): this section only appears on the
  // MOVE-IN document, since its legal effect (report issues within 14
  // days or they're deemed accepted) only makes sense as something
  // stated AT move-in, not repeated on the move-out doc. Payment-channel
  // specifics (GPay/bank for rent, Pinnacle office for maintenance) are
  // fixed boilerplate text for now, not a per-property config field, per
  // explicit decision -- can be made configurable later if needed.
  // Font size and spacing kept tight throughout (size 16 vs the body's
  // 18, minimal paragraph gaps) specifically to fit the whole document
  // on one page per explicit requirement -- verified by rendering to
  // PDF and checking actual page count, not just visual estimation.
  return [
    p(r(' ', { size: 8 }), { spacing: { after: 60 } }),
    centerLabel('IMPORTANT TERMS & CONDITIONS', { size: 18 }),

    p([
      r('Reporting Window: ', { bold: true, size: 16 }),
      r('This Move-In Inspection Report must be reviewed and returned within ', { size: 16 }),
      r('fourteen (14) days', { bold: true, size: 16 }),
      r(' of the move-in date stated above. Any defect, damage, or issue not explicitly noted in the table above within this period shall be deemed confirmed as being in good, working condition at the time of move-in, and the tenant accepts the property on that basis.', { size: 16 }),
    ], { spacing: { after: 90 } }),

    p([
      r('Property Condition: ', { bold: true, size: 16 }),
      r('By signing below, both parties agree that all unlisted items and areas are confirmed to be in good, working condition. Any existing defects must be explicitly noted in the table above.', { size: 16 }),
    ], { spacing: { after: 90 } }),

    p([
      r('Rent Payment & Due Dates: ', { bold: true, size: 16 }),
      r('Rent is due on the 1st of every month. Payments made between the 2nd and 5th of the month are considered late, but no late fees or penalties will apply during this grace period.', { size: 16 }),
    ], { spacing: { after: 90 } }),

    p([
      r('Payment Channels: ', { bold: true, size: 16 }),
      r('Monthly rent is to be paid via Google Pay (GPay) or directly to the Owner\u2019s bank account. Maintenance fees are to be paid directly at the Pinnacle management office.', { size: 16 }),
    ], { spacing: { after: 90 } }),

    p([
      r('Move-Out Obligations: ', { bold: true, size: 16 }),
      r('Upon ending the lease, the tenant must return the flat in the same condition it was received. This includes ensuring all walls are painted back to the original color/specification, all broken items are repaired, and the flat is handed over clean and completely free of trash or garbage.', { size: 16 }),
    ], { spacing: { after: 0 } }),
  ]
}

function buildMoveReportDocument({ kind, property, tenantName, eventDate, rooms }) {
  const title = kind === 'move-out' ? 'MOVE-OUT INSPECTION REPORT' : 'MOVE-IN INSPECTION REPORT'
  const propLabel = property?.fullAddress || (property?.building
    ? `${property.building}${property.unitNo ? ', Unit ' + property.unitNo : ''}, ${property.city || property.location || ''}`
    : (property?.name || '[PROPERTY]'))

  const children = [
    centerLabel(title, { size: 28 }),
    p([
      r('Property: ', { bold: true }), r(propLabel),
    ], { spacing: { after: 80 } }),
    p([
      r('Tenant: ', { bold: true }), r(tenantName || '[TENANT NAME]'),
    ], { spacing: { after: 80 } }),
    p([
      r(`${kind === 'move-out' ? 'Move-Out' : 'Move-In'} Date: `, { bold: true }), r(fmtLongDate(eventDate)),
    ], { spacing: { after: 400 } }),

    p(r('This report records the condition of the property and its fixtures at the time of ' +
      (kind === 'move-out' ? 'move-out' : 'move-in') +
      '. Both parties should review and initial each section before signing below.', { size: 18 }),
      { spacing: { after: 300 } }),

    checklistTable(rooms),
    p(r(' '), { spacing: { after: 100 } }),
    meterReadingsTable(),

    p(r(' '), { spacing: { after: 200 } }),
    twoColRow('LANDLORD / REPRESENTATIVE', 'TENANT', { before: 100, after: 60, bold: true }),
    twoColRow('_______________________', '_______________________', { before: 200, after: 40 }),
    twoColRow('Signature & Date', 'Signature & Date', { before: 0, after: 0 }),

    ...(kind === 'move-in' ? termsAndConditionsSection() : []),
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
 * @param {'move-in'|'move-out'} kind
 * @param {object} agreement - saved rental_props row
 * @param {object} property  - a row from getAllProperties (usePropertyList), same field shape as the old CONFIG.rentalProperties entries
 * @param {string} [eventDate] - defaults to today if not given
 */
export async function downloadMoveReport(kind, agreement, property, eventDate) {
  if (!agreement?.tenant_name) {
    throw new Error('Cannot generate move report — tenant name is required. Fill this in and save first.')
  }
  const doc = buildMoveReportDocument({
    kind,
    property,
    tenantName: agreement.tenant_name,
    eventDate: eventDate || localTodayStr(),
    rooms: DEFAULT_ROOMS,
  })
  const label = kind === 'move-out' ? 'Move-Out Report' : 'Move-In Report'
  await triggerDownload(doc, `${label} - ${property.name} - ${agreement.tenant_name}.docx`)
}
