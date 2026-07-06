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
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status} on ${action}`)
    if (data?.success === false) throw new Error(data.error || `Failed: ${action}`)
    logger.info('API:GET', `${action} OK`)
    // NOTE: must NOT use `data?.data ?? data` here — `??` treats a
    // legitimately-null `data.data` (a correct "nothing found" response,
    // e.g. getIncomingTenant/getActiveStay/findOpenStay) as absent and
    // falls through to returning the whole {success,data} wrapper object
    // instead of null. That wrapper is truthy, so callers doing
    // `if (!result)` never catch the "nothing found" case. Checking `in`
    // distinguishes "no data property" from "data property is null".
    return (data && typeof data === 'object' && 'data' in data) ? data.data : data
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
    // Read the JSON body first — our API returns a helpful { error } even on
    // 4xx/5xx (e.g. the double-booking message on a 409). Surface that rather
    // than a bare "HTTP 409".
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status} on ${action}`)
    if (data?.success === false) throw new Error(data.error || `Failed: ${action}`)
    logger.info('API:POST', `${action} OK`)
    // See matching note in get() above — same fix, same reason.
    return (data && typeof data === 'object' && 'data' in data) ? data.data : data
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
  recentActivity:           (p)      => get('recentActivity', p),
  createProvisionalBooking: (data)   => post('createProvisionalBooking', data),
  approvePendingBooking:    (data)   => post('approvePendingBooking', data),
  setReadyForCheckIn:       (data)   => post('setReadyForCheckIn', data),

  // ── STAY / CHECK-IN ──────────────────────────────────────
  getPendingCheckIns:   ()       => get('getPendingCheckIns'),
  createBooking:        (data)   => post('createBooking', data),
  ocrPlate:             (data)   => post('ocrPlate', data),
  ocrReceipt:           (data)   => post('ocrReceipt', data),
  confirmCheckIn:       (data)   => post('confirmCheckIn', data),
  resolveStay:          (data)   => post('resolveStay', data),
  deleteStay:           (data)   => post('deleteStay', data),
  resolveDuplicate:     (data)   => post('resolveDuplicate', data),
  checkOut:             (data)   => post('checkOut', data),
  cancelStay:           (data)   => post('cancelStay', data),
  updateStayStatus:     (data)   => post('updateStayStatus', data),
  searchGuestsByName:   (q)      => get('searchGuestsByName', { q }),
  linkBookedBy:         (data)   => post('linkBookedBy', data),
  getActiveStay:        (villaId)=> get('getActiveStay', { villaId }),
  getUpcomingStays:     (villaId)=> get('getUpcomingStays', { villaId }),

  // ── VILLA INCOME ─────────────────────────────────────────
  saveVillaRentalIncome:(data)   => post('saveVillaRentalIncome', data),
  saveKitchenEntry:     (data)   => post('saveKitchenEntry', data),
  getRecentCheckouts:   (villaId) => get('getRecentCheckouts', { villaId }),
  saveBreakfastEntry:   (data)   => post('saveBreakfastEntry', data),
  saveCarRental:        (data)   => post('saveCarRental', data),
  saveVillaExpense:     (data)   => post('saveVillaExpense', data),
  getVillaExpenses:     (villaId) => get('getVillaExpenses', { villaId }),
  deleteVillaExpense:   (data)   => post('deleteVillaExpense', data),
  getVillaSettings:     (villaId) => get('getVillaSettings', { villaId }),
  getAlertLog:          (limit)   => get('getAlertLog', limit ? { limit } : {}),
  saveVillaSetting:     (data)   => post('saveVillaSetting', data),

  // ── RENTAL PROPERTIES ────────────────────────────────────
  saveRentalIncome:     (data)   => post('saveRentalIncome', data),
  getRentalIncome:      (m, y)   => get('getRentalIncome', { month: m, year: y }),
  getRentalDashboard:   (year)   => get('getRentalDashboard', { year }),
  getRentalAgreements:  ()       => get('getRentalAgreements'),
  getAllProperties:     ()       => get('getAllProperties'),
  saveRentalAgreement:  (data)   => post('saveRentalAgreement', data),
  updateTenantStatus:   (data)   => post('updateTenantStatus', data),
  updateTenantStage:    (data)   => post('updateTenantStage', data),
  updateRentalDocChecklist: (data) => post('updateRentalDocChecklist', data),
  getRentTransactions: (propId)  => get('getRentTransactions', { propId }),
  postRentPayment:     (data)    => post('postRentPayment', data),
  getPropertyExpenses:  (propId, year) => get('getPropertyExpenses', { propId, year }),
  getMaintenanceEvents: (propId, month, year) => get('getMaintenanceEvents', { propId, month, year }),
  saveMaintenanceEvent: (data) => post('saveMaintenanceEvent', data),
  deleteMaintenanceEvent: (eventId) => post('deleteMaintenanceEvent', { eventId }),
  savePropertyExpense:  (data)         => post('savePropertyExpense', data),
  getTenancyHistory:    (propId) => get('getTenancyHistory', { propId }),
  saveTenancyHistory:   (data)   => post('saveTenancyHistory', data),
  deleteTenancyHistory: (historyId) => post('deleteTenancyHistory', { historyId }),
  getIncomingTenant:    (propId) => get('getIncomingTenant', { propId }),
  saveIncomingTenant:   (data)   => post('saveIncomingTenant', data),
  deleteIncomingTenant: (propId) => post('deleteIncomingTenant', { propId }),
  moveInIncomingTenant: (data)   => post('moveInIncomingTenant', data),
  markIncomingDepositPaid: (data) => post('markIncomingDepositPaid', data),

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

  // -- PROPERTY DOCUMENTS --
  getPropertyDocs:      (propId) => get('getPropertyDocs', { propId }),
  savePropertyDoc:      (data)   => post('savePropertyDoc', data),
  deletePropertyDoc:    (data)   => post('deletePropertyDoc', data),

  // -- HOA & TAX HISTORY --
  getHoaHistory:        (propId) => get('getHoaHistory', { propId }),
  saveHoaEntry:         (data)   => post('saveHoaEntry', data),
  deleteHoaEntry:       (data)   => post('deleteHoaEntry', data),
  getTaxHistory:        (propId) => get('getTaxHistory', { propId }),
  saveTaxEntry:         (data)   => post('saveTaxEntry', data),
  deleteTaxEntry:       (data)   => post('deleteTaxEntry', data),

  getManagerQuickInfo:  ()       => get('getManagerQuickInfo'),
  getCoconutMarketPrice: ()      => get('getCoconutMarketPrice'),
  getEstateHighlights:        (estate) => get('getEstateHighlights', { estate }),
  getIrrigationZoneHealth:    (estate) => get('getIrrigationZoneHealth', { estate }),
  saveIrrigationZoneLog:      (data)   => post('saveIrrigationZoneLog', data),
  saveIrrigationZone:         (data)   => post('saveIrrigationZone', data),
  saveFertilization:       (data)   => post('saveFertilization', data),
  saveMangoHarvest:        (data)   => post('saveMangoHarvest', data),
  getMangoHarvests:        (estate) => get('getMangoHarvests', { estate }),
  getIrrigationHistory:    (estate) => get('getIrrigationHistory', { estate }),
  getEstateContacts:       (estate) => get('getEstateContacts', { estate }),
  logIrrigation:        (data)   => post('logIrrigation', data),

  // ── COCONUT ──────────────────────────────────────────────
  saveCoconutHarvest:   (data)   => post('saveCoconutHarvest', data),
  getCoconutHarvests:   (year)   => get('getCoconutHarvests', { year }),

  // ── RUBBER ───────────────────────────────────────────────
  saveRubberHarvest:    (data)        => post('saveRubberHarvest', data),
  getRubberHarvests:    (year, estate) => get('getRubberHarvests', { year, estate: estate || 'pavutumuri' }),
  saveRubberProduction: (data)        => post('saveRubberProduction', data),
  getRubberProduction:  (params)      => get('getRubberProduction', { estate: 'pavutumuri', ...(params||{}) }),
  deleteRubberProduction:(data)       => post('deleteRubberProduction', data),
  saveManagerSettlement:(data)        => post('saveManagerSettlement', data),
  getManagerSettlements:(estate)      => get('getManagerSettlements', { estate: estate || 'pavutumuri' }),
  deleteManagerSettlement:(data)      => post('deleteManagerSettlement', data),

  // ── ESTATES ──────────────────────────────────────────────
  saveEstateTransaction:  (data)   => post('saveEstateTransaction', data),
  getEstateTransactions:  (estate) => get('getEstateTransactions', { estate }),
  deleteEstateTransaction:(data)   => post('deleteEstateTransaction', data),
  getEstateDashboard:     (estate) => get('getEstateDashboard', { estate }),


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
  getRamanReport:       ()       => get('getRamanReport'),
  // -- MARKETING CAMPAIGNS --
  getCampaigns:         (villaId)  => get('getCampaigns', { villaId }),
  getCampaignAnalytics: (id)       => get('getCampaignAnalytics', { campaignId: id }),
  createCampaign:       (data)     => post('createCampaign', data),
  toggleCampaign:       (data)     => post('toggleCampaign', data),
  deleteCampaign:       (data)     => post('deleteCampaign', data),
  trackCampaignClick:   (data)     => post('trackCampaignClick', data),
  trackCampaignAction:  (data)     => post('trackCampaignAction', data),

  getMarketingStats:    (villaId, statYear) => get('getMarketingStats', { villaId: villaId || 'dwarka', ...(statYear ? { statYear: String(statYear) } : {}) }),
  getRamanHistory:      ()       => get('getRamanHistory'),
  markRamanPaid:        (data)   => post('markRamanPaid', data),

  // ── REVIEW CHASE ─────────────────────────────────────────
  getReviewChaseList:   ()       => get('getReviewChaseList'),
  markReviewChased:     (data)   => post('markReviewChased', data),
  closeStayWithReview:  (data)   => post('closeStayWithReview', data),

  // ── INVENTORY ────────────────────────────────────────────
  saveInventoryPrices:         (data)   => post('saveInventoryPrices', data),
  getInventoryPrices:          (vId)    => get('getInventoryPrices', { villaId: vId }),
  saveInventoryRestock:        (data)   => post('saveInventoryRestock', data),
  getInventoryRestockLog:      (vId)    => get('getInventoryRestockLog', { villaId: vId }),
  getStayPhotos:               (stayId) => get('getStayPhotos', { stayId }),
  getInventory:                (vId)    => get('getInventory', { villaId: vId }),
  saveInventoryStock:          (data)   => post('saveInventoryStock', data),
  saveInventoryPreferredStock: (data)   => post('saveInventoryPreferredStock', data),
  addInventoryItem:            (data)   => post('addInventoryItem', data),
  archiveInventoryItem:        (data)   => post('archiveInventoryItem', data),
  restoreInventoryItem:        (data)   => post('restoreInventoryItem', data),
  getLowStockItems:            (vId)    => get('getLowStockItems', { villaId: vId }),

  // ── GUEST ENQUIRY MANAGEMENT (CRM) ───────────────────────
  getEnquiries:         (vId, status) => get('getEnquiries', status ? { villaId: vId, status } : { villaId: vId }),
  getStaleEnquiries:    ()            => get('getStaleEnquiries'),
  markReminderSent:     (data)        => post('markReminderSent', data),
  logScriptEvent:       (data)        => post('logScriptEvent', data),
  getEnquiryDetail:     (enquiryId)   => get('getEnquiryDetail', { enquiryId }),
  findGuestMatch:       (phone, email) => get('findGuestMatch', { phone: phone || '', email: email || '' }),
  saveEnquiry:          (data)        => post('saveEnquiry', data),
  logCommunication:     (data)        => post('logCommunication', data),
  markEnquiryLost:      (data)        => post('markEnquiryLost', data),
  confirmEnquiry:       (data)        => post('confirmEnquiry', data),
  getEnquiryDashboard:  (vId, year)   => get('getEnquiryDashboard', year ? { villaId: vId, year } : { villaId: vId }),
  getEnquiryFollowUps:  (vId)         => get('getEnquiryFollowUps', { villaId: vId }),
  getRateCard:          (vId)         => get('getRateCard', { villaId: vId }),

  // ── MAINTENANCE / SCHEMA VALIDATION ────────────────────────
  getSchemaSnapshot: () => get('getSchemaSnapshot'),

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
      const parts = [body?.error || `HTTP ${res.status}`]
      if (body?.errorCause) parts.push(`(cause: ${body.errorCause})`)
      throw new Error(parts.join(' '))
    }
    const body = await res.json()
    if (body?.success === false) {
      const parts = [body.error || 'Query failed']
      if (body?.errorCause) parts.push(`(cause: ${body.errorCause})`)
      throw new Error(parts.join(' '))
    }
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
