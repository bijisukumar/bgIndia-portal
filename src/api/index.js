// ============================================================
//  bgIndia Portal — API Layer  (v2.0 — JWT auth)
//  All methods identical signatures to before — screens unchanged.
//  X-Actor header replaced with Authorization: Bearer <jwt>
//  401 responses trigger automatic logout.
// ============================================================
import { logger } from '../utils/logger.js'

const BASE = '/api'

function getToken() {
  try { return sessionStorage.getItem('ge_token') || '' }
  catch { return '' }
}

function authHeaders(extra = {}) {
  const token = getToken()
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra,
  }
}

// On 401 — clear session and reload to login screen
function handle401() {
  sessionStorage.removeItem('ge_token')
  window.location.href = '/'
}

async function get(action, params = {}) {
  logger.info('API:GET', action, params)
  try {
    const qs  = new URLSearchParams(params).toString()
    const url = qs ? `${BASE}/${action}?${qs}` : `${BASE}/${action}`
    const res = await fetch(url, { headers: authHeaders() })
    if (res.status === 401) { handle401(); return }
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body:    JSON.stringify(payload),
    })
    if (res.status === 401) { handle401(); return }
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
  // ── CHECKIN LINKS ────────────────────────────────────────────
  resolveCheckinLink: (data)   => post('resolveCheckinLink', data),
  getCheckinLinks:    ()       => get('getCheckinLinks'),
  createCheckinLink:  (data)   => post('createCheckinLink', data),
  toggleCheckinLink:  (data)   => post('toggleCheckinLink', data),

  // ── GUEST CHECK-IN FORM (public) ───────────────────────────
  submitGuestCheckIn:       (data)   => post('submitGuestCheckIn', data),

  // ── PROVISIONAL / PENDING REVIEW ───────────────────────────
  getPendingReviewStays:    ()       => get('getPendingReviewStays'),
  getDuplicateBookings:     (p)      => get('getDuplicateBookings', p),
  createProvisionalBooking: (data)   => post('createProvisionalBooking', data),
  approvePendingBooking:    (data)   => post('approvePendingBooking', data),

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
  updateTenantStatus:   (data)   => post('updateTenantStatus', data),

  // ── LEASE LOSSES / CLAIMS ────────────────────────────────
  getLeaseLosses:       (propId) => get('getLeaseLosses', { propId }),
  saveLeaseLoss:        (data)   => post('saveLeaseLoss', data),
  deleteLeaseLoss:      (data)   => post('deleteLeaseLoss', data),
  updateLeaseLossStatus:(data)   => post('updateLeaseLossStatus', data),

  // ── PORTFOLIO DASHBOARD ──────────────────────────────────
  getRev360Dashboard:   ()       => get('getRev360Dashboard'),

  // -- PROPERTY DETAILS --
  getPropertyDetails:   (propId) => get('getPropertyDetails', { propId }),
  savePropertyDetails:  (data)   => post('savePropertyDetails', data),

  getPradoshQuickInfo:  ()       => get('getPradoshQuickInfo'),
  logIrrigation:        (data)   => post('logIrrigation', data),

  // ── COCONUT ──────────────────────────────────────────────
  saveCoconutHarvest:   (data)   => post('saveCoconutHarvest', data),
  getCoconutHarvests:   (year)   => get('getCoconutHarvests', { year }),

  // ── RUBBER ───────────────────────────────────────────────
  saveRubberHarvest:    (data)   => post('saveRubberHarvest', data),
  getRubberHarvests:    (year)   => get('getRubberHarvests', { year }),

  // ── ESTATES ──────────────────────────────────────────────
  saveEstateTransaction:(data)   => post('saveEstateTransaction', data),
  getEstateTransactions:(estate, y) => get('getEstateTransactions', { estate, year: y || new Date().getFullYear() }),
  getEstateDashboard:   (year)   => get('getEstateDashboard', { year }),

  // ── DASHBOARDS ───────────────────────────────────────────
  getVillaDashboard:    (vId, y) => get('getVillaDashboard', { villaId: vId, year: y }),
  getStays:             (vId, y) => get('getStays', { villaId: vId, year: y }),
  getGuests:            ()       => get('getGuests'),

  // ── TENANT CONFIG ─────────────────────────────────────────
  getTenantConfig:      (tenantId) => get('getTenantConfig', { tenantId: tenantId || 'dwarka' }),

  // ── RAMAN ────────────────────────────────────────────────
  getRamanTodo:         (villaId)=> get('getRamanTodo', { villaId: villaId || 'dwarka' }),
  getRamanUnpaid:       ()       => get('getRamanUnpaid'),
  getRamanDashboard:    ()       => get('getRamanDashboard'),
  getMarketingStats:    (villaId, statYear) => get('getMarketingStats', { villaId: villaId || 'dwarka', ...(statYear ? { statYear: String(statYear) } : {}) }),
  getRamanHistory:      ()       => get('getRamanHistory'),
  markRamanPaid:        (data)   => post('markRamanPaid', data),

  // ── REVIEW CHASE ─────────────────────────────────────────
  getReviewChaseList:   ()       => get('getReviewChaseList'),
  markReviewChased:     (data)   => post('markReviewChased', data),
  closeStayWithReview:  (data)   => post('closeStayWithReview', data),

  // ── INVENTORY ────────────────────────────────────────────
  saveInventoryPrices:  (data)   => post('saveInventoryPrices', data),
  getInventoryPrices:   (vId)    => get('getInventoryPrices', { villaId: vId }),
  saveInventoryRestock: (data)   => post('saveInventoryRestock', data),
  getInventory:         (vId)    => get('getInventory', { villaId: vId }),

  // ── AD-HOC QUERIES (D1Explorer) ──────────────────────────
  runSQL: async (sql) => {
    const qs  = new URLSearchParams({ sql }).toString()
    const res = await fetch(`${BASE}/runSQL?${qs}`, { headers: authHeaders() })
    if (res.status === 401) { handle401(); return }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (body?.success === false) throw new Error(body.error || 'Query failed')
    return body.data
  },

  runSQLWrite: async (sql) => {
    const res = await fetch(`${BASE}/runSQLWrite`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    })
    if (res.status === 401) { handle401(); return }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `HTTP ${res.status}`)
    }
    const body = await res.json()
    if (body?.success === false) throw new Error(body.error || 'Query failed')
    return body.data
  },

  runQuery: async (key) => {
    const qs  = new URLSearchParams({ key }).toString()
    const res = await fetch(`${BASE}/runQuery?${qs}`, { headers: authHeaders() })
    if (res.status === 401) { handle401(); return }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (body?.success === false) throw new Error(body.error || 'Query failed')
    return body.data
  },
}
