// ============================================================
//  formatChoice.js
//  Per explicit decision (2026-06-28): documents default to PDF (with
//  the lessor's signature baked in), but every generator keeps its
//  original .docx version available too — toggled via a small
//  checkbox next to each Generate button — for cases where the owner
//  needs to hand-edit specific wording after generating (something a
//  PDF doesn't allow without separate tools).
//
//  This module centralizes the "which format, which function" wiring
//  so each card component doesn't repeat an isPdf ? pdfFn : docxFn
//  branch at every one of its 8 call sites.
// ============================================================
import { downloadDepositReceipt, downloadRentReceipt } from './generateReceipt'
import { downloadDepositReceiptPdf, downloadRentReceiptPdf } from './generatePdfReceipt'
import { downloadMoveReport } from './generateMoveReport'
import { downloadMoveReportPdf } from './generatePdfMoveReport'
import { downloadLeaseDeed } from './generateLeaseDeed'
import { downloadLeaseDeedPdf } from './generatePdfLeaseDeed'

export async function generateDepositReceipt(isPdf, agreement, property) {
  return isPdf ? downloadDepositReceiptPdf(agreement, property) : downloadDepositReceipt(agreement, property)
}

export async function generateRentReceipt(isPdf, rentTxn, agreement, property) {
  return isPdf ? downloadRentReceiptPdf(rentTxn, agreement, property) : downloadRentReceipt(rentTxn, agreement, property)
}

export async function generateMoveReportAny(isPdf, kind, agreement, property, eventDate) {
  return isPdf ? downloadMoveReportPdf(kind, agreement, property, eventDate) : downloadMoveReport(kind, agreement, property, eventDate)
}

export async function generateLeaseDeedAny(isPdf, agreement, property) {
  return isPdf ? downloadLeaseDeedPdf(agreement, property) : downloadLeaseDeed(agreement, property)
}
