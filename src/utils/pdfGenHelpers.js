// ============================================================
//  pdfGenHelpers.js
//  Shared pdf-lib helpers for the document generators on the Tenant
//  Agreement screen (deposit/rent receipts, move-in/move-out reports,
//  lease deed). Built alongside docGenHelpers.js (the docx version)
//  rather than replacing it -- per explicit decision (2026-06-28),
//  documents now generate as PDF, with a signature image baked in
//  automatically above the lessor's printed name on every document.
//
//  pdf-lib has no Paragraph/TextRun/Table abstractions like docx does
//  -- everything is positioned by x/y coordinates on a page, so this
//  module provides a small "cursor" abstraction (PdfCursor) that
//  tracks the current y-position and moves down as content is drawn,
//  plus manual text-wrapping (measuring string width against the
//  loaded font) and tables-as-drawn-lines.
// ============================================================
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Re-exported pure formatting helpers — identical logic to
// docGenHelpers.js, duplicated here rather than imported cross-format
// since docGenHelpers.js pulls in `docx` (Paragraph/TextRun), which
// has no place in a pdf-lib file and would bloat the bundle for no
// reason. Single source of truth for the actual formatting RULES
// would be nice long-term, but these are pure functions with zero
// behavioral risk in duplicating; not worth a bigger refactor now.
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function parseLocalDateSafe(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function fmtLongDate(dateStr) {
  const d = parseLocalDateSafe(dateStr)
  if (!d) return '[date]'
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${ordinal(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtCurrency(n, currency = 'INR') {
  const v = Math.round(Number(n) || 0)
  if (currency === 'USD') return `$${v.toLocaleString('en-US')}`
  return `₹${v.toLocaleString('en-IN')}`
}

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
    return `US Dollars ${fmtCurrency(n, 'USD').replace('$', '')} only`
  }
  return `Rupees ${numberToWordsIndian(n)} only`
}

// ── Page setup ──────────────────────────────────────────────────────
export const PAGE = { width: 595.28, height: 841.89 } // A4 in points (72pt/inch), matches the docx version's A4 size
export const MARGIN = { top: 56, right: 56, bottom: 56, left: 56 } // ~0.78in, slightly tighter than the docx 1080-twip (0.75in) margin to give a bit more working room since pdf-lib text wrapping is manual

// ── Cursor: tracks current Y position on the current page, creates
// new pages automatically when content would overflow. ────────────
export class PdfCursor {
  constructor(doc, fonts) {
    this.doc = doc
    this.fonts = fonts // { regular, bold }
    this.page = doc.addPage([PAGE.width, PAGE.height])
    this.y = PAGE.height - MARGIN.top
    this.x = MARGIN.left
    this.contentWidth = PAGE.width - MARGIN.left - MARGIN.right
  }

  ensureSpace(neededHeight) {
    if (this.y - neededHeight < MARGIN.bottom) {
      this.page = this.doc.addPage([PAGE.width, PAGE.height])
      this.y = PAGE.height - MARGIN.top
    }
  }

  moveDown(amount) { this.y -= amount }

  // Draw a single line of text at the current cursor position, with
  // optional bold/size/color/align, then move the cursor down.
  drawLine(text, opts = {}) {
    const size = opts.size || 11
    const font = opts.bold ? this.fonts.bold : this.fonts.regular
    const color = opts.color || rgb(0, 0, 0)
    let x = this.x
    if (opts.align === 'center') {
      const w = font.widthOfTextAtSize(text, size)
      x = MARGIN.left + (this.contentWidth - w) / 2
    } else if (opts.align === 'right') {
      const w = font.widthOfTextAtSize(text, size)
      x = PAGE.width - MARGIN.right - w
    }
    this.ensureSpace(size + (opts.spacingAfter ?? 4))
    this.page.drawText(text, { x, y: this.y, size, font, color })
    this.moveDown(size + (opts.spacingAfter ?? 4))
  }

  // Draw mixed bold/regular runs on one logical line (e.g. "Label: "
  // bold followed by a regular value) — wraps to multiple visual lines
  // if the combined text exceeds content width, using a simple
  // greedy word-wrap that respects each run's own bold/regular font
  // for width measurement.
  drawRuns(runs, opts = {}) {
    const size = opts.size || 11
    const lineGap = opts.lineGap ?? 3
    const spacingAfter = opts.spacingAfter ?? 8
    // Flatten runs into words for wrapping, each tagged with which run
    // (and thus font) it belongs to. Split using a regex that keeps
    // the space as part of the preceding word (e.g. "the " not "the"),
    // so spacing is correct EVEN AT RUN BOUNDARIES — splitting on ' '
    // and checking array-index position (the previous approach) loses
    // the space whenever a run has no internal spaces of its own (e.g.
    // a bold "₹35,000" run followed by a run starting with a space —
    // the boundary space was being silently dropped).
    const words = []
    runs.forEach(run => {
      const font = run.bold ? this.fonts.bold : this.fonts.regular
      const text = String(run.text)
      const chunks = text.match(/\S+\s*|\s+/g) || []
      chunks.forEach(chunk => { if (chunk) words.push({ text: chunk, font, bold: !!run.bold }) })
    })
    let line = []
    let lineWidth = 0
    const lines = []
    words.forEach(word => {
      const w = word.font.widthOfTextAtSize(word.text, size)
      if (lineWidth + w > this.contentWidth && line.length > 0) {
        lines.push(line)
        line = []
        lineWidth = 0
      }
      line.push(word)
      lineWidth += w
    })
    if (line.length) lines.push(line)

    lines.forEach((ln, idx) => {
      this.ensureSpace(size + lineGap)
      let x = this.x
      ln.forEach(word => {
        this.page.drawText(word.text, { x, y: this.y, size, font: word.font, color: rgb(0,0,0) })
        x += word.font.widthOfTextAtSize(word.text, size)
      })
      this.moveDown(size + lineGap)
    })
    this.moveDown(spacingAfter - lineGap)
  }

  // Simple two-column row (label left, value right), used for
  // signature blocks and Payment Date/Mode style key-value lines.
  drawTwoCol(left, right, opts = {}) {
    const size = opts.size || 11
    const font = opts.bold ? this.fonts.bold : this.fonts.regular
    this.ensureSpace(size + (opts.spacingAfter ?? 8))
    this.page.drawText(left, { x: this.x, y: this.y, size, font, color: rgb(0,0,0) })
    if (right) {
      const halfWidth = this.contentWidth / 2
      this.page.drawText(right, { x: MARGIN.left + halfWidth, y: this.y, size, font, color: rgb(0,0,0) })
    }
    this.moveDown(size + (opts.spacingAfter ?? 8))
  }

  drawHorizontalLine(opts = {}) {
    this.ensureSpace(4)
    this.page.drawLine({
      start: { x: this.x, y: this.y },
      end: { x: PAGE.width - MARGIN.right, y: this.y },
      thickness: opts.thickness || 0.75,
      color: opts.color || rgb(0.6, 0.6, 0.6),
    })
    this.moveDown(opts.spacingAfter ?? 8)
  }
}

// ── Table drawn as lines (header row shaded, body rows bordered) ───
// columns: [{ label, width }] widths in points, summing to contentWidth
export function drawTable(cursor, columns, rows, opts = {}) {
  const rowHeight = opts.rowHeight || 22
  const headerHeight = opts.headerHeight || 20
  const fontSize = opts.fontSize || 9
  const totalWidth = columns.reduce((s, c) => s + c.width, 0)
  cursor.ensureSpace(headerHeight + rowHeight * rows.length)

  let colX = cursor.x
  const tableTop = cursor.y

  // Header background
  cursor.page.drawRectangle({
    x: cursor.x, y: cursor.y - headerHeight, width: totalWidth, height: headerHeight,
    color: rgb(0.91, 0.91, 0.91),
  })
  columns.forEach(col => {
    cursor.page.drawText(col.label, {
      x: colX + 4, y: cursor.y - headerHeight + 6, size: fontSize,
      font: cursor.fonts.bold, color: rgb(0,0,0),
    })
    colX += col.width
  })
  cursor.moveDown(headerHeight)

  rows.forEach(row => {
    cursor.ensureSpace(rowHeight)
    let cx = cursor.x
    columns.forEach((col, ci) => {
      const cellText = String(row[ci] ?? '')
      cursor.page.drawText(cellText, {
        x: cx + 4, y: cursor.y - rowHeight + 8, size: fontSize,
        font: cursor.fonts.regular, color: rgb(0,0,0),
      })
      cx += col.width
    })
    cursor.moveDown(rowHeight)
  })

  // Border lines: outer rectangle + column separators + row separators
  const tableBottom = cursor.y
  const totalHeight = tableTop - tableBottom
  cursor.page.drawRectangle({
    x: cursor.x, y: tableBottom, width: totalWidth, height: totalHeight,
    borderColor: rgb(0.6,0.6,0.6), borderWidth: 0.75, color: undefined,
  })
  let sepX = cursor.x
  columns.forEach((col, i) => {
    if (i > 0) {
      cursor.page.drawLine({
        start: { x: sepX, y: tableTop }, end: { x: sepX, y: tableBottom },
        thickness: 0.75, color: rgb(0.6,0.6,0.6),
      })
    }
    sepX += col.width
  })
  let sepY = tableTop - headerHeight
  for (let i = 0; i < rows.length; i++) {
    cursor.page.drawLine({
      start: { x: cursor.x, y: sepY }, end: { x: cursor.x + totalWidth, y: sepY },
      thickness: 0.5, color: rgb(0.75,0.75,0.75),
    })
    sepY -= rowHeight
  }
  cursor.moveDown(opts.spacingAfter ?? 12)
}

// ── Signature block: draws the embedded signature image directly
// above the printed lessor name + "(Received by / on behalf of
// Lessor)" caption, with today's date alongside it so it's clear
// when the document was generated/signed. ──────────────────────────
// ── Signature block: draws the embedded signature image directly
// above the printed lessor name + caption, side-by-side with a blank
// signature line for the tenant (we don't have the tenant's signature
// to embed, so that side stays a normal blank line to sign by hand).
// Today's date is printed under the lessor's side so it's clear when
// the document was generated. ──────────────────────────────────────
export async function drawSignatureBlock(cursor, { lessorName, dateStr, label }) {
  // Never draw the actual signature image above an unidentified
  // [LANDLORD NAME] placeholder (the no-lease-config fallback for
  // non-INR/unconfigured properties, see generatePdfReceipt.js) — a
  // signature image implies a specific person signed; showing it next
  // to "unknown landlord" would be a real inconsistency, not just a
  // missing-data placeholder like the rest of the document.
  const hasRealLessor = lessorName && lessorName !== '[LANDLORD NAME]'
  const sigBytes = hasRealLessor ? await fetchSignatureBytes() : null
  const sigHeight = 32
  const halfWidth = cursor.contentWidth / 2

  cursor.moveDown(10) // breathing room between whatever came before (e.g. "LANDLORD / TENANT" headers) and the signature art
  cursor.ensureSpace(sigHeight + 60)
  const imageBaseY = cursor.y

  if (sigBytes) {
    const img = await cursor.doc.embedPng(sigBytes)
    const scale = sigHeight / img.height
    const sigWidth = img.width * scale
    cursor.page.drawImage(img, {
      x: cursor.x, y: imageBaseY - sigHeight, width: sigWidth, height: sigHeight,
    })
  }
  cursor.moveDown(sigHeight + 6)

  // Two signature lines side by side — landlord's is "backed" by the
  // image drawn just above it; tenant's stays blank for a wet-ink
  // signature on the printed/PDF copy.
  cursor.page.drawLine({
    start: { x: cursor.x, y: cursor.y }, end: { x: cursor.x + halfWidth - 20, y: cursor.y },
    thickness: 0.75, color: rgb(0.4,0.4,0.4),
  })
  cursor.page.drawLine({
    start: { x: cursor.x + halfWidth, y: cursor.y }, end: { x: cursor.x + cursor.contentWidth, y: cursor.y },
    thickness: 0.75, color: rgb(0.4,0.4,0.4),
  })
  cursor.moveDown(12)

  cursor.page.drawText((lessorName || '[LESSOR]').toUpperCase(), {
    x: cursor.x, y: cursor.y, size: 10, font: cursor.fonts.bold, color: rgb(0,0,0),
  })
  cursor.page.drawText('TENANT', {
    x: cursor.x + halfWidth, y: cursor.y, size: 10, font: cursor.fonts.bold, color: rgb(0,0,0),
  })
  cursor.moveDown(13)

  cursor.page.drawText(label || '(Lessor)', {
    x: cursor.x, y: cursor.y, size: 8, font: cursor.fonts.regular, color: rgb(0.3,0.3,0.3),
  })
  cursor.page.drawText('(Signature & Date)', {
    x: cursor.x + halfWidth, y: cursor.y, size: 8, font: cursor.fonts.regular, color: rgb(0.3,0.3,0.3),
  })
  cursor.moveDown(11)

  cursor.page.drawText(`Signed: ${fmtLongDate(dateStr)}`, {
    x: cursor.x, y: cursor.y, size: 8, font: cursor.fonts.regular, color: rgb(0.3,0.3,0.3),
  })
  cursor.moveDown(14)
}

let _cachedSignatureBytes = null
async function fetchSignatureBytes() {
  if (_cachedSignatureBytes) return _cachedSignatureBytes
  try {
    const res = await fetch('/icons/signature.png')
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    _cachedSignatureBytes = new Uint8Array(buf)
    return _cachedSignatureBytes
  } catch (e) {
    console.warn('Could not load signature image:', e)
    return null
  }
}

// ── Document bootstrap: create a PDFDocument + embedded Unicode fonts
// + an initial cursor, used identically by every generator. ────────
//
// CRITICAL: pdf-lib's StandardFonts (Helvetica etc) use WinAnsi
// encoding, which CANNOT render the Rupee sign (₹, U+20B9) — it
// throws at render time. Since the overwhelming majority of
// documents this app generates are in INR, this is a hard blocker,
// not a cosmetic issue. Fixed by embedding DejaVu Sans (confirmed to
// contain the Rupee glyph) via fontkit instead of using a standard
// font. Both regular and bold weights are fetched from /fonts/ at
// runtime, same static-asset pattern as the signature image.
let _cachedFontBytes = null
async function fetchFontBytes() {
  if (_cachedFontBytes) return _cachedFontBytes
  const [regularRes, boldRes] = await Promise.all([
    fetch('/fonts/DejaVuSans.ttf'),
    fetch('/fonts/DejaVuSans-Bold.ttf'),
  ])
  if (!regularRes.ok || !boldRes.ok) {
    throw new Error('Could not load fonts for PDF generation (DejaVuSans.ttf/DejaVuSans-Bold.ttf missing from /public/fonts/).')
  }
  _cachedFontBytes = {
    regular: new Uint8Array(await regularRes.arrayBuffer()),
    bold: new Uint8Array(await boldRes.arrayBuffer()),
  }
  return _cachedFontBytes
}

export async function createPdfWithCursor() {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fontBytes = await fetchFontBytes()
  const regular = await doc.embedFont(fontBytes.regular, { subset: true })
  const bold = await doc.embedFont(fontBytes.bold, { subset: true })
  const cursor = new PdfCursor(doc, { regular, bold })
  return { doc, cursor }
}

export async function triggerPdfDownload(doc, filename) {
  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
