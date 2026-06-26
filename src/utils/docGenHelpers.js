// ============================================================
//  docGenHelpers.js
//  Shared formatting + docx-builder helpers used by the document
//  generators on the Tenant Agreement screen (receipt of payment,
//  move-in/move-out reports). Deliberately factored out of
//  generateLeaseDeed.js rather than edited into it, so the already
//  tested deed generator stays untouched.
// ============================================================
import { Paragraph, TextRun, AlignmentType, TabStopType, TabStopPosition } from 'docx'
import { parseLocalDate } from './dates'

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// "1st July 2026"
export function fmtLongDate(dateStr) {
  const d = parseLocalDate(dateStr)
  if (!d) return '[date]'
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${ordinal(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtCurrency(n, currency = 'INR') {
  const v = Math.round(Number(n) || 0)
  if (currency === 'USD') return `$${v.toLocaleString('en-US')}`
  return `₹${v.toLocaleString('en-IN')}`
}

// Indian lakh/crore word converter — same algorithm as generateLeaseDeed.js,
// duplicated intentionally rather than imported (that file has no exports
// for this), kept here so future non-India documents can build their own
// equivalent without touching the deed generator's internals.
export function numberToWordsIndian(num) {
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

export function fmtCurrencyWords(n, currency = 'INR') {
  if (currency === 'USD') {
    // No US word-converter built yet (no US lease data exists to need one
    // for yet) — degrade to a plain numeric statement rather than
    // fabricating English-words-for-dollars logic nobody has asked for.
    return `US Dollars ${fmtCurrency(n, 'USD').replace('$', '')} only`
  }
  return `Rupees ${numberToWordsIndian(n)} only`
}

export const FONT = 'Arial'

export function p(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { after: 200, ...opts.spacing },
    children: Array.isArray(children) ? children : [children],
  })
}

export function r(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: 22, bold: !!opts.bold, ...opts })
}

export function centerLabel(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, ...opts.spacing },
    children: [r(text, { bold: true, size: opts.size || 22 })],
  })
}

// Two-column signature row using tab stops (per docx skill guidance —
// never use a table purely as a layout divider). When rightText is empty,
// omit the second run entirely rather than creating an empty TextRun (an
// empty bold run still renders/extracts as a visible artifact in some
// readers, e.g. doubled markdown bold markers around nothing).
export function twoColRow(leftText, rightText, opts = {}) {
  const children = [r(leftText, { bold: !!opts.bold })]
  if (rightText) {
    children.push(new TextRun({ text: `\t${rightText}`, font: FONT, size: 22, bold: !!opts.bold }))
  }
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: opts.before ?? 300, after: opts.after ?? 100 },
    children,
  })
}
