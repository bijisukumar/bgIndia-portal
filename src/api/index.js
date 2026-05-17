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

// ── AUDIT: resolve the current actor from session storage ──────────────────
// Set by Login.jsx on successful PIN entry: sessionStorage.setItem('ge_actor', role)
// Allowed values: owner | raman | pradosh | auto | system
// The Worker reads the X-Actor header to stamp created_by / updated_by on every row.
function getActor() {
  try { return sessionStorage.getItem('ge_actor') || 'owner' }
  catch { return 'owner' }
}

async function get(action, params = {}) {
  logger.info('API:GET', action, params)
  try {
    const qs  = new URLSearchParams(params).toString()
    const url = qs ? `${BASE}/${action}?${qs}` : `${BASE}/${action}`
    const res = await fetch(url, {
      headers: { 'X-Actor': getActor() },
    })
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
      headers: {
        'Content-Type': 'application/json',
        'X-Actor':      getActor(),   // stamps created_by / updated_by in D1
      },
      body: JSON.stringify(payload),
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
  checkOut:             (data)   => post('checkOut', data),
  cancelStay:           (data)   => post('cancelStay', data),
  updateStayStatus:     (data)   => post('updateStayStatus', data),
  getActiveStay:        (villaId)=> get('getActiveStay', { villaId }),
  getUpcomingStays:     (villaId)=> get('getUpcomingStays', { villaId }),

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
  getRentalAgreements:  ()       => get('getRentalAgreements'),
  saveRentalAgreement:  (data)   => post('saveRentalAgreement', data),

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
  getRamanDashboard:    ()       => get('getRamanDashboard'),
  getMarketingStats:    (villaId) => get('getMarketingStats', { villaId: villaId || 'dwarka' }),
  getRamanHistory:      ()       => get('getRamanHistory'),
  markRamanPaid:        (data)   => post('markRamanPaid', data),

  // ── INVENTORY ────────────────────────────────────────────
  saveInventoryPrices:  (data)   => post('saveInventoryPrices', data),
  getInventoryPrices:   (vId)    => get('getInventoryPrices', { villaId: vId }),
  saveInventoryRestock: (data)   => post('saveInventoryRestock', data),
  getInventory:         (vId)    => get('getInventory', { villaId: vId }),

  // ── AD-HOC QUERIES (D1Explorer) ──────────────────────────
  // Free-form SQL — any SELECT query
  runSQL: async (sql) => {
    const qs  = new URLSearchParams({ sql }).toString()
    const res = await fetch(`${BASE}/runSQL?${qs}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (body?.success === false) throw new Error(body.error || 'Query failed')
    return body.data
  },

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
