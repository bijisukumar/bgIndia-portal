// ============================================================
//  API LAYER — All Apps Script calls go through here.
//  Action strings must match your Apps Script doPost handler.
// ============================================================

import { CONFIG } from '../config.js'

const URL = CONFIG.appsScriptUrl

async function post(action, payload) {
  const res = await fetch(URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function get(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString()
  const res = await fetch(`${URL}?${qs}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// ── STAY / CHECK-IN ─────────────────────────────────────────
export const api = {

  // Fetch pending guest form submissions (not yet confirmed)
  getPendingCheckIns: () =>
    get('getPendingCheckIns'),

  // Confirm a check-in (Raman taps confirm + uploads car photos)
  confirmCheckIn: (data) =>
    post('confirmCheckIn', data),

  // Get current active stay for a villa
  getActiveStay: (villaId) =>
    get('getActiveStay', { villaId }),

  // ── VILLA INCOME ───────────────────────────────────────────
  saveVillaRentalIncome: (data) =>
    post('saveVillaRentalIncome', data),

  saveKitchenEntry: (data) =>
    post('saveKitchenEntry', data),

  saveBreakfastEntry: (data) =>
    post('saveBreakfastEntry', data),

  saveCarRental: (data) =>
    post('saveCarRental', data),

  // ── VILLA EXPENSES ─────────────────────────────────────────
  saveVillaExpense: (data) =>
    post('saveVillaExpense', data),

  // ── RENTAL PROPERTIES ─────────────────────────────────────
  saveRentalIncome: (data) =>
    post('saveRentalIncome', data),

  getRentalIncome: (month, year) =>
    get('getRentalIncome', { month, year }),

  // ── COCONUT TRACKER ───────────────────────────────────────
  saveCoconutHarvest: (data) =>
    post('saveCoconutHarvest', data),

  getCoconutHarvests: (year) =>
    get('getCoconutHarvests', { year }),

  // ── RUBBER TRACKER ────────────────────────────────────────
  saveRubberHarvest: (data) =>
    post('saveRubberHarvest', data),

  getRubberHarvests: (year) =>
    get('getRubberHarvests', { year }),

  // ── ESTATE INCOME / EXPENSE ───────────────────────────────
  saveEstateTransaction: (data) =>
    post('saveEstateTransaction', data),

  getEstateTransactions: (estateId, year) =>
    get('getEstateTransactions', { estateId, year }),

  // ── DASHBOARDS ────────────────────────────────────────────
  getVillaDashboard: (villaId, year) =>
    get('getVillaDashboard', { villaId, year }),

  getEstateDashboard: (year) =>
    get('getEstateDashboard', { year }),

  getRentalDashboard: (year) =>
    get('getRentalDashboard', { year }),

  // ── IRRIGATION (existing) ─────────────────────────────────
  // Kept as webview links — no change needed
}
