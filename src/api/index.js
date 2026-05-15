// ============================================================
//  bgIndia Portal — API Layer
//  NOW CONNECTED TO: Cloudflare D1 via Pages Function (/api/*)
//  All methods have identical signatures to before — screens
//  don't need any changes.
// ============================================================
import { logger } from '../utils/logger.js'

// In production (Cloudflare Pages), /api/* is handled by the Worker.
// In local dev (npm run dev), requests proxy to the Worker via vite proxy.
const BASE = '/api'

async function get(action, params = {}) {
  logger.info('API:GET', action, params)
  try {
    const qs  = new URLSearchParams(params).toString()
    const url = qs ? `${BASE}/${action}?${qs}` : `${BASE}/${action}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${action}`)
    const data = await res.json()
    if (data?.success === false) throw new Error(data.error || `Failed: ${action}`)
    logger.info('API:GET', `${action} OK`)
    return data?.data ?? data
  } catch (err) {
    logger.error('API:GET', err, { action, params })
    throw err
  }
}

async function post(action, payload) {
  logger.info('API:POST', action, payload)
  try {
    const res = await fetch(`${BASE}/${action}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${action}`)
    const data = await res.json()
    if (data?.success === false) throw new Error(data.error || `Failed: ${action}`)
    logger.info('API:POST', `${action} OK`)
    return data?.data ?? data
  } catch (err) {
    logger.error('API:POST', err, { action })
    throw err
  }
}

export const api = {
  // ── STAY / CHECK-IN ──────────────────────────────────────
  getPendingCheckIns:   ()       => get('getPendingCheckIns'),
  createBooking:        (data)   => post('createBooking', data),
  confirmCheckIn:       (data)   => post('confirmCheckIn', data),
  getActiveStay:        (villaId)=> get('getActiveStay', { villaId }),

  // ── VILLA INCOME ─────────────────────────────────────────
  saveVillaRentalIncome:(data)   => post('saveVillaRentalIncome', data),
  saveKitchenEntry:     (data)   => post('saveKitchenEntry', data),
  saveBreakfastEntry:   (data)   => post('saveBreakfastEntry', data),
  saveCarRental:        (data)   => post('saveCarRental', data),
  saveVillaExpense:     (data)   => post('saveVillaExpense', data),

  // ── RENTAL PROPERTIES ────────────────────────────────────
  saveRentalIncome:     (data)   => post('saveRentalIncome', data),
  getRentalIncome:      (m, y)   => get('getRentalIncome', { month: m, year: y }),
  getRentalDashboard:   (year)   => get('getRentalDashboard', { year }),

  // ── COCONUT ──────────────────────────────────────────────
  saveCoconutHarvest:   (data)   => post('saveCoconutHarvest', data),
  getCoconutHarvests:   (year)   => get('getCoconutHarvests', { year }),

  // ── RUBBER ───────────────────────────────────────────────
  saveRubberHarvest:    (data)   => post('saveRubberHarvest', data),
  getRubberHarvests:    (year)   => get('getRubberHarvests', { year }),

  // ── ESTATES ──────────────────────────────────────────────
  saveEstateTransaction:(data)   => post('saveEstateTransaction', data),
  getEstateTransactions:(id, y)  => get('getEstateTransactions', { estateId: id, year: y }),
  getEstateDashboard:   (year)   => get('getEstateDashboard', { year }),

  // ── DASHBOARDS ───────────────────────────────────────────
  getVillaDashboard:    (vId, y) => get('getVillaDashboard', { villaId: vId, year: y }),
  getStays:             (vId, y) => get('getStays', { villaId: vId, year: y }),
  getGuests:            ()       => get('getGuests'),

  // ── RAMAN ────────────────────────────────────────────────
  getRamanUnpaid:       ()       => get('getRamanUnpaid'),
  getRamanHistory:      ()       => get('getRamanHistory'),
  markRamanPaid:        (data)   => post('markRamanPaid', data),

  // ── INVENTORY ────────────────────────────────────────────
  saveInventoryPrices:  (data)   => post('saveInventoryPrices', data),
  getInventoryPrices:   (vId)    => get('getInventoryPrices', { villaId: vId }),
  saveInventoryRestock: (data)   => post('saveInventoryRestock', data),
  getInventory:         (vId)    => get('getInventory', { villaId: vId }),

  // ── AD-HOC QUERIES (D1Explorer) ──────────────────────────
  // Returns full response object (not just .data) so D1Explorer gets both rows + sql
  runQuery: async (key) => {
    const qs  = new URLSearchParams({ key }).toString()
    const res = await fetch(`${BASE}/runQuery?${qs}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (body?.success === false) throw new Error(body.error || 'Query failed')
    return body.data   // array of rows
  },
}
