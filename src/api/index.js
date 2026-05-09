import { logger } from '../utils/logger.js'
import { CONFIG } from '../config.js'

const URL = CONFIG.appsScriptUrl

// ── CORS NOTE ─────────────────────────────────────────────────
// Google Apps Script deployed as "Anyone can access" supports CORS
// BUT only when:
//   1. No custom request headers are sent (no Content-Type: application/json)
//   2. GET requests use query params
//   3. POST requests send data as URL-encoded form data, not JSON body
// This is a known Apps Script limitation. We work around it below.
// ─────────────────────────────────────────────────────────────

async function get(action, params = {}) {
  logger.info('API:GET', action, params)
  try {
    const qs  = new URLSearchParams({ action, ...params }).toString()
    const res = await fetch(`${URL}?${qs}`, {
      method: 'GET',
      // No custom headers — required for Apps Script CORS
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} on action: ${action}`)
    const data = await res.json()
    if (data && data.success === false) throw new Error(data.error || `Action failed: ${action}`)
    logger.info('API:GET', `${action} OK`)
    return data?.data ?? data
  } catch(err) {
    logger.error('API:GET', err, { action, params })
    throw err
  }
}

async function post(action, payload) {
  logger.info('API:POST', action, payload)
  try {
    // Send as URL-encoded form data to avoid CORS preflight
    // Apps Script reads this via e.parameter
    const body = new URLSearchParams({
      payload: JSON.stringify({ action, ...payload })
    })
    const res = await fetch(URL, {
      method: 'POST',
      // No Content-Type header — let browser set it automatically for form data
      body,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} on action: ${action}`)
    const data = await res.json()
    if (data && data.success === false) throw new Error(data.error || `Action failed: ${action}`)
    logger.info('API:POST', `${action} OK`)
    return data?.data ?? data
  } catch(err) {
    logger.error('API:POST', err, { action })
    throw err
  }
}

// ── STAY / CHECK-IN ─────────────────────────────────────────
export const api = {

  getPendingCheckIns: () =>
    get('getPendingCheckIns'),

  createBooking: (data) =>
    post('createBooking', data),

  confirmCheckIn: (data) =>
    post('confirmCheckIn', data),

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
}
