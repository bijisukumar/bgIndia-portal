// ============================================================
//  RentalAgreement.jsx — v4: real 4-stage tenancy lifecycle
//
//  Lifecycle model (per explicit decision, 2026-06-27):
//    stage:          'Signed Up' -> 'Active' -> 'Notice Given' -> 'Completed'
//    is_delinquent:  0/1 flag that can sit on top of Active/Notice Given
//                    (behind on rent while still living there) -- NOT a
//                    stage of its own.
//    end_reason:     only meaningful when stage='Completed' -- 'Lease Ended'
//                    / 'Early Termination' / 'Evicted' / 'Runaway' /
//                    'After Delinquency'.
//
//  The property TAB LIST defaults to showing only Active + Notice Given
//  properties (what's actually relevant day to day). Signed Up and
//  Completed properties are tucked away behind small toggle buttons
//  rather than living in the main filter row, since they're checked
//  rarely. Past Tenants (manually back-filled historic records, a
//  SEPARATE table from the live agreement) are reached via a dedicated
//  per-property button, NOT a tab filter -- a property's current tenant
//  can be Active while it separately has past tenants on file, so
//  filtering tabs by lifecycle stage can never surface that property
//  under a "history" filter.
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { CONFIG } from '../../config'
import { parseLocalDate } from '../../utils/dates'
import TenantProfileCard from './TenantProfileCard'
import DocumentEngineCard from './DocumentEngineCard'
import FinancialsReceiptCard from './FinancialsReceiptCard'
import MetaDiagnosticsCard from './MetaDiagnosticsCard'
import { usePropertyList } from './usePropertyList'
import TenancyHistoryCard from './TenancyHistoryCard'
import IncomingTenantCard from './IncomingTenantCard'

const STAGES = ['Signed Up','Active','Notice Given','Completed']
const STAGE_COLOR = {
  'Signed Up':'#185FA5','Active':'#34A853','Notice Given':'#F59E0B','Completed':'#5C7080',
}
const END_REASONS = ['Lease Ended','Early Termination','Evicted','Runaway','After Delinquency']
const DRIVE_FOLDER_TEMPLATE = (tenantName, propName) =>
  `RentalManagement/${propName}/${tenantName}`

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const parsed = parseLocalDate(dateStr)
  if (!parsed) return null
  return Math.round((parsed - today) / (1000*60*60*24))
}
function leaseDurationMonths(start, end) {
  if (!start || !end) return null
  const s = parseLocalDate(start), e = parseLocalDate(end)
  if (!s || !e) return null
  const m = Math.round((e - s) / (1000*60*60*24*30.44))
  return m > 0 ? m : null
}

const EMPTY_FORM = {
  tenantName:'', tenantEmail:'', tenantPhone:'', tenantAddress:'', tenantPan:'',
  deposit:'', agreedRent:'',
  maintenance:'', leaseStart:'', leaseEnd:'', notes:'',
  country:'IN', currency:'INR', driveFolderUrl:'',
  stage:'Signed Up', isDelinquent:false, endReason:'',
  nextRenewalDate:'', earlyTerminated:false, earlyTerminationDate:'',
  isMonthToMonth:false, monthToMonthSince:'',
  docContractSigned:false, docIdCaptured:false, docMoveIn:false, docMoveOut:false, docDamageReport:false,
  moveOutDocShared:false, moveOutDocsReceived:false, damageChargesDeducted:'', depositRefunded:'',
  hasSeparateParking:false,
  parkingTenantName:'', parkingTenantPhone:'',
  parkingFee:'', parkingDeposit:'',
  parkingLeaseStart:'', parkingLeaseEnd:'', parkingCurrency:'INR',
  parkingPaidInFull:false,
}

export default function RentalAgreement() {
  const navigate = useNavigate()
  const { properties, reload: reloadProperties } = usePropertyList()
  const [country, setCountry] = useState('IN')
  const [showSignedUp, setShowSignedUp] = useState(false)   // tucked-away toggle
  const [showCompleted, setShowCompleted] = useState(false) // tucked-away toggle
  const [showHistory, setShowHistory] = useState(false)     // Past Tenants card visibility, per selected property
  const [selectedProp, setSelectedProp] = useState(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [agreements, setAgreements] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [toast, setToast]     = useState(null)
  const [closingOut, setClosingOut] = useState(false)
  const [closeOutReason, setCloseOutReason] = useState('')
  const [closeOutBusy, setCloseOutBusy] = useState(false)
  const [showAddProp, setShowAddProp] = useState(false)
  const [newProp, setNewProp] = useState({ name:'', location:'', country:'IN', currency:'INR' })
  const [addingProp, setAddingProp] = useState(false)

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  const setField = (key, val) => setForm(f => ({...f, [key]: val}))

  useEffect(() => { loadAgreements() }, [])

  async function loadAgreements() {
    setLoading(true)
    try {
      const data = await api.getRentalAgreements()
      const map = {}
      ;(Array.isArray(data) ? data : []).forEach(a => { map[a.prop_id] = a })
      setAgreements(map)
    } catch(e) { console.warn(e) }
    finally { setLoading(false) }
  }

  // Pick the initial selected property once BOTH agreements and the
  // live property list have loaded -- these are two independent
  // fetches (getRentalAgreements + usePropertyList's getAllProperties)
  // that can resolve in either order, so this can't safely live inside
  // loadAgreements() itself.
  useEffect(() => {
    if (selectedProp || properties.length === 0 || loading) return
    const inDayToDay = properties.find(p => matchesDayToDay(p, agreements, 'IN'))
      || properties[0]
    if (inDayToDay) {
      setSelectedProp(inDayToDay.id)
      if (agreements[inDayToDay.id]) prefill(agreements[inDayToDay.id])
    }
  }, [properties, agreements, loading])

  function getStage(propId, agreementsMap) {
    const a = agreementsMap[propId]
    return a?.stage || 'Signed Up'
  }
  function getCountry(prop, agreementsMap) {
    const a = agreementsMap[prop.id]
    return a?.country || prop.country || 'IN'
  }

  // Default tab list: only Active + Notice Given, for the country in view.
  function matchesDayToDay(prop, agreementsMap, ctry) {
    if (getCountry(prop, agreementsMap) !== ctry) return false
    const stage = getStage(prop.id, agreementsMap)
    return stage === 'Active' || stage === 'Notice Given'
  }

  function prefill(a) {
    setForm({
      tenantName:    a.tenant_name    || '',
      tenantEmail:   a.tenant_email   || '',
      tenantPhone:   a.tenant_phone   || '',
      tenantAddress: a.tenant_address || '',
      tenantPan:     a.tenant_pan     || '',
      deposit:       a.deposit        || '',
      agreedRent:    a.agreed_rent    || '',
      maintenance:   a.maintenance_fee|| '',
      leaseStart:    a.lease_start    || '',
      leaseEnd:      a.lease_end      || '',
      notes:         a.notes          || '',
      country:       a.country        || 'IN',
      currency:      a.currency       || 'INR',
      driveFolderUrl:a.drive_folder_url || '',
      stage:         a.stage          || 'Signed Up',
      isDelinquent:  !!a.is_delinquent,
      endReason:     a.end_reason     || '',
      nextRenewalDate:      a.next_renewal_date      || '',
      earlyTerminated:      !!a.early_terminated,
      earlyTerminationDate: a.early_termination_date || '',
      isMonthToMonth:    !!a.is_month_to_month,
      monthToMonthSince: a.month_to_month_since || '',
      docContractSigned: !!a.doc_contract_signed,
      docIdCaptured:     !!a.doc_id_captured,
      docMoveIn:         !!a.doc_move_in,
      docMoveOut:        !!a.doc_move_out,
      docDamageReport:   !!a.doc_damage_report,
      moveOutDocShared:    !!a.move_out_doc_shared,
      moveOutDocsReceived: !!a.move_out_docs_received,
      damageChargesDeducted: a.damage_charges_deducted || '',
      depositRefunded:       a.deposit_refunded || '',
      hasSeparateParking:   !!a.has_separate_parking,
      parkingTenantName:  a.parking_tenant_name  || '',
      parkingTenantPhone: a.parking_tenant_phone || '',
      parkingFee:         a.parking_fee          || '',
      parkingDeposit:     a.parking_deposit      || '',
      parkingLeaseStart:  a.parking_lease_start  || '',
      parkingLeaseEnd:    a.parking_lease_end    || '',
      parkingCurrency:    a.parking_currency     || a.currency || 'INR',
      parkingPaidInFull:  !!a.parking_paid_in_full,
    })
  }

  function handlePropChange(propId) {
    setSelectedProp(propId)
    setError('')
    setShowHistory(false)
    if (agreements[propId]) prefill(agreements[propId])
    else setForm({...EMPTY_FORM, country, currency: country === 'US' ? 'USD' : 'INR'})
  }

  function handleCountryChange(newCountry) {
    setCountry(newCountry)
    setShowSignedUp(false); setShowCompleted(false)
    const visible = properties.filter(p => matchesDayToDay(p, agreements, newCountry))
    if (visible[0]) handlePropChange(visible[0].id)
    else setSelectedProp(null)
  }

  function handleTenantNameChange(val) {
    setField('tenantName', val)
    const prop = properties.find(p => p.id === selectedProp)
    if (val && prop && !form.driveFolderUrl) {
      setField('driveFolderUrl', DRIVE_FOLDER_TEMPLATE(val.replace(/\s+/g,'-'), prop.name))
    }
  }

  async function handleStageChange(newStage) {
    const payload = { propId: selectedProp, stage: newStage, isDelinquent: form.isDelinquent, endReason: form.endReason }
    // Completing a tenancy needs a reason -- ask via inline state rather
    // than silently defaulting to 'Lease Ended' for every completion.
    if (newStage === 'Completed' && !form.endReason) {
      setField('stage', newStage) // open the end-reason picker; not saved until a reason is chosen
      return
    }
    setField('stage', newStage)
    try {
      await api.updateTenantStage(payload)
      setAgreements(prev => ({...prev, [selectedProp]: {...prev[selectedProp], stage:newStage, is_delinquent:form.isDelinquent?1:0, end_reason:form.endReason||null}}))
      showToast(`Stage updated to ${newStage}`)
    } catch(e) { showToast('Stage update failed', 'error') }
  }

  async function handleEndReasonChange(reason) {
    setField('endReason', reason)
    try {
      await api.updateTenantStage({ propId: selectedProp, stage: 'Completed', isDelinquent: form.isDelinquent, endReason: reason })
      setAgreements(prev => ({...prev, [selectedProp]: {...prev[selectedProp], stage:'Completed', end_reason:reason}}))
      showToast(`Marked Completed — ${reason}`)
    } catch(e) { showToast('Update failed', 'error') }
  }

  async function handleDelinquentToggle() {
    const next = !form.isDelinquent
    setField('isDelinquent', next)
    try {
      await api.updateTenantStage({ propId: selectedProp, stage: form.stage, isDelinquent: next, endReason: form.endReason })
      setAgreements(prev => ({...prev, [selectedProp]: {...prev[selectedProp], is_delinquent: next?1:0}}))
      showToast(next ? '⚠️ Marked behind on rent' : 'Delinquent flag cleared')
    } catch(e) { showToast('Update failed', 'error'); setField('isDelinquent', !next) }
  }

  async function handleDocToggle(field, currentValue) {
    const newValue = !currentValue
    setField(field, newValue)
    if (!agreements[selectedProp]) return
    const backendField = {
      docContractSigned:'doc_contract_signed', docIdCaptured:'doc_id_captured',
      docMoveIn:'doc_move_in', docMoveOut:'doc_move_out', docDamageReport:'doc_damage_report',
    }[field]
    try {
      await api.updateRentalDocChecklist({ propId: selectedProp, field: backendField, value: newValue })
      setAgreements(prev => ({...prev, [selectedProp]: {...prev[selectedProp], [backendField]: newValue ? 1 : 0}}))
    } catch(e) { showToast('Could not update checklist', 'error'); setField(field, currentValue) }
  }

  // Pre-fills a fresh lease term starting from the current lease end,
  // defaulting to 11 months (the standard Indian residential term — long
  // enough to avoid needing a new tenant search, short enough to dodge the
  // mandatory registration/stamp-duty threshold that kicks in at 12+
  // months). Only drafts the new dates into the form — nothing is saved
  // until the owner reviews them in Lease Terms below and hits Save, same
  // as any other edit on this screen.
  function handleRenewContract() {
    const base = parseLocalDate(form.leaseEnd)
    if (!base) return
    const newStart = new Date(base)
    const newEnd = new Date(base)
    newEnd.setMonth(newEnd.getMonth() + 11)
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    setForm(f => ({
      ...f,
      leaseStart: fmt(newStart),
      leaseEnd: fmt(newEnd),
      isMonthToMonth: false,
      monthToMonthSince: '',
      nextRenewalDate: '',
    }))
    showToast(`Renewal drafted: ${fmt(newStart)} → ${fmt(newEnd)} — review below and Save to confirm`)
  }

  // Closes out the current tenant with NO replacement lined up yet (e.g.
  // Tritvam expecting a vacancy gap). Archives them to Past Tenants —
  // same as the Incoming Tenant "Move In Now" swap, just without a new
  // tenant to swap in — and clears this property's form back to blank so
  // a fresh tenant can be entered whenever one's found, instead of the
  // departed tenant's data lingering here.
  async function handleCloseOut() {
    if (!closeOutReason) return
    setCloseOutBusy(true)
    try {
      const outgoingName = form.tenantName
      await api.closeOutTenant({ propId: selectedProp, endReason: closeOutReason })
      showToast(`${outgoingName} closed out and archived — ${prop?.name} is now vacant`)
      setAgreements(prev => ({...prev, [selectedProp]: {
        ...prev[selectedProp],
        tenant_name:'', tenant_email:'', tenant_phone:'', tenant_address:'', tenant_pan:'',
        deposit:0, agreed_rent:0, maintenance_fee:0, lease_start:null, lease_end:null,
        notes:null, drive_folder_url:null,
        stage:'Signed Up', status:'Signed Up', is_delinquent:0, end_reason:null,
        early_terminated:0, early_termination_date:null,
        is_month_to_month:0, month_to_month_since:null, next_renewal_date:null,
        doc_contract_signed:0, doc_id_captured:0, doc_move_in:0, doc_move_out:0, doc_damage_report:0,
        move_out_doc_shared:0, move_out_docs_received:0, damage_charges_deducted:0, deposit_refunded:0,
      }}))
      setForm({ ...EMPTY_FORM, country: form.country, currency: form.currency })
      setClosingOut(false); setCloseOutReason('')
    } catch (e) { showToast(e.message || 'Close out failed', 'error') }
    finally { setCloseOutBusy(false) }
  }

  async function handleSave() {
    setError('')
    if (!form.tenantName.trim()) { setError('Tenant name is required'); return }
    if (!form.leaseStart) { setError('Lease start is required'); return }
    if (!form.leaseEnd)   { setError('Lease end is required'); return }
    if (parseLocalDate(form.leaseEnd) <= parseLocalDate(form.leaseStart)) { setError('Lease end must be after start'); return }
    if (form.earlyTerminated && !form.earlyTerminationDate) { setError('Early termination date is required when marked early-terminated'); return }
    if (form.isMonthToMonth && !form.monthToMonthSince) { setError('Month-to-month start date is required when marked month-to-month'); return }
    setSaving(true)
    try {
      const prop = properties.find(p => p.id === selectedProp)
      await api.saveRentalAgreement({
        propId:       selectedProp,
        propName:     prop?.name || selectedProp,
        location:     prop?.location || '',
        country:      form.country,
        currency:     form.currency,
        tenantName:   form.tenantName.trim(),
        tenantEmail:  form.tenantEmail.trim(),
        tenantPhone:  form.tenantPhone.trim(),
        tenantAddress:form.tenantAddress.trim(),
        tenantPan:    form.tenantPan.trim(),
        deposit:      parseFloat(form.deposit) || 0,
        agreedRent:   parseFloat(form.agreedRent) || 0,
        maintenance:  parseFloat(form.maintenance) || 0,
        leaseStart:   form.leaseStart,
        leaseEnd:     form.leaseEnd,
        notes:        form.notes.trim(),
        driveFolderUrl: form.driveFolderUrl.trim(),
        nextRenewalDate:      form.nextRenewalDate || null,
        earlyTerminated:      form.earlyTerminated,
        earlyTerminationDate: form.earlyTerminated ? form.earlyTerminationDate : null,
        isMonthToMonth:    form.isMonthToMonth,
        monthToMonthSince: form.isMonthToMonth ? form.monthToMonthSince : null,
        docContractSigned: form.docContractSigned,
        docIdCaptured:     form.docIdCaptured,
        docMoveIn:         form.docMoveIn,
        docMoveOut:        form.docMoveOut,
        docDamageReport:   form.docDamageReport,
        moveOutDocShared:      form.moveOutDocShared,
        moveOutDocsReceived:   form.moveOutDocsReceived,
        damageChargesDeducted: parseFloat(form.damageChargesDeducted) || 0,
        depositRefunded:       parseFloat(form.depositRefunded) || 0,
        hasSeparateParking:   form.hasSeparateParking,
        parkingTenantName:  form.parkingTenantName.trim(),
        parkingTenantPhone: form.parkingTenantPhone.trim(),
        parkingFee:         form.hasSeparateParking ? parseFloat(form.parkingFee) || 0 : 0,
        parkingDeposit:     form.hasSeparateParking ? parseFloat(form.parkingDeposit) || 0 : 0,
        parkingLeaseStart:  form.hasSeparateParking ? form.parkingLeaseStart || null : null,
        parkingLeaseEnd:    form.hasSeparateParking ? form.parkingLeaseEnd || null : null,
        parkingCurrency:    form.parkingCurrency || form.currency || 'INR',
        parkingPaidInFull:  form.hasSeparateParking ? form.parkingPaidInFull : false,
      })
      // saveRentalAgreement never touches stage/is_delinquent/end_reason
      // (confirmed in the backend) -- those are only ever changed via
      // updateTenantStage, so it's safe to merge the rest here without
      // risk of clobbering whatever stage was last set.
      setAgreements(prev => ({...prev, [selectedProp]: {...prev[selectedProp],
        prop_id:selectedProp, tenant_name:form.tenantName, tenant_email:form.tenantEmail,
        tenant_phone:form.tenantPhone, tenant_address:form.tenantAddress, tenant_pan:form.tenantPan,
        deposit:parseFloat(form.deposit)||0, agreed_rent:parseFloat(form.agreedRent)||0,
        maintenance_fee:parseFloat(form.maintenance)||0,
        lease_start:form.leaseStart, lease_end:form.leaseEnd,
        country:form.country, currency:form.currency, drive_folder_url:form.driveFolderUrl,
        next_renewal_date:form.nextRenewalDate, early_terminated:form.earlyTerminated?1:0, early_termination_date:form.earlyTerminationDate,
        is_month_to_month:form.isMonthToMonth?1:0, month_to_month_since:form.monthToMonthSince,
        doc_contract_signed:form.docContractSigned?1:0, doc_id_captured:form.docIdCaptured?1:0,
        doc_move_in:form.docMoveIn?1:0, doc_move_out:form.docMoveOut?1:0, doc_damage_report:form.docDamageReport?1:0,
        move_out_doc_shared:form.moveOutDocShared?1:0, move_out_docs_received:form.moveOutDocsReceived?1:0,
        damage_charges_deducted:parseFloat(form.damageChargesDeducted)||0, deposit_refunded:parseFloat(form.depositRefunded)||0,
        has_separate_parking:form.hasSeparateParking?1:0,
        parking_tenant_name:form.parkingTenantName, parking_tenant_phone:form.parkingTenantPhone,
        parking_fee:parseFloat(form.parkingFee)||0, parking_deposit:parseFloat(form.parkingDeposit)||0,
        parking_lease_start:form.parkingLeaseStart, parking_lease_end:form.parkingLeaseEnd,
        parking_currency:form.parkingCurrency,
        parking_paid_in_full:form.parkingPaidInFull?1:0,
      }}))

      // If paid in full — bulk-post one rent_transaction row per month
      // of the parking lease term. Uses INSERT OR IGNORE so re-saving
      // the agreement never creates duplicates.
      if (form.hasSeparateParking && form.parkingPaidInFull && form.parkingLeaseStart && form.parkingLeaseEnd && form.parkingFee) {
        const [sy, sm] = form.parkingLeaseStart.split('-').map(Number)
        const [ey, em] = form.parkingLeaseEnd.split('-').map(Number)
        const months = []
        let cy = sy, cm = sm
        while (cy * 12 + cm <= ey * 12 + em) {
          months.push(`${cy}-${String(cm).padStart(2,'0')}`)
          cm++; if (cm > 12) { cm = 1; cy++ }
        }
        const fee = parseFloat(form.parkingFee) || 0
        const cur2 = new Date()
        const paidDate = form.parkingLeaseStart.slice(0,10) // treat lease start as payment date
        let posted = 0, skipped = 0
        await Promise.allSettled(months.map(async period => {
          try {
            await api.postRentPayment({
              propId: selectedProp, periodMonth: period,
              baseRent: fee, maintenance: 0, carParking: 0, lateFee: 0,
              isException: false, unitType: 'parking',
              paidDate, currency: form.parkingCurrency || form.currency || 'INR',
            })
            posted++
          } catch(e) {
            if (String(e.message||'').includes('already been posted')) skipped++
            else throw e
          }
        }))
        const msg = skipped > 0
          ? `✅ Agreement saved · ${posted} parking months posted (${skipped} already existed)`
          : `✅ Agreement saved · ${posted} parking months posted (${months[0]} → ${months[months.length-1]})`
        showToast(msg)
      } else {
        showToast(`✅ Agreement saved for ${prop?.name}`)
      }
    } catch(e) { setError(`Save failed: ${e.message}`) }
    finally { setSaving(false) }
  }

  async function handleAddProperty() {
    if (!newProp.name.trim()) return
    setAddingProp(true)
    try {
      const id = 'rental_' + Date.now()
      await api.saveRentalAgreement({
        propId:id, propName:newProp.name.trim(), location:newProp.location.trim(),
        country:newProp.country, currency:newProp.currency,
        tenantName:'', deposit:0, agreedRent:0, maintenance:0,
        leaseStart:'', leaseEnd:'', notes:'',
      })
      // Re-fetch from the database rather than mutating the old static
      // CONFIG.rentalProperties array -- that mutation never persisted
      // across a page reload, which is the exact bug being fixed here
      // (a property added this way would vanish from every screen the
      // moment the page reloaded, even though it WAS correctly saved).
      await reloadProperties()
      setCountry(newProp.country)
      setSelectedProp(id); setForm({...EMPTY_FORM, country:newProp.country, currency:newProp.currency})
      setNewProp({name:'',location:'',country:'IN',currency:'INR'}); setShowAddProp(false)
      showToast(`${newProp.name} added`)
    } catch(e) { showToast('Could not add: ' + e.message, 'error') }
    finally { setAddingProp(false) }
  }

  // getAllProperties (usePropertyList) already computes fullAddress
  // server-side via a JOIN with property_details, and already prefers
  // the real property_details.city over the static location guess --
  // no client-side re-merge needed here anymore.
  const prop = properties.find(p => p.id === selectedProp)
  const saved = !!agreements[selectedProp]
  const days = daysUntil(form.leaseEnd)
  const duration = leaseDurationMonths(form.leaseStart, form.leaseEnd)
  const expiryColor = days===null?'#34A853':days<0?'#c62828':days<=30?'#e67e22':days<=60?'#f1c40f':'#34A853'
  // Month-to-month suppresses this entirely (explicit decision,
  // 2026-06-27) — once a tenancy has gone rolling, the original fixed
  // lease_end is no longer a real deadline to warn about.
  const expiryMsg = form.isMonthToMonth ? null : (days===null?null:days<0?`⚠️ Lease EXPIRED ${Math.abs(days)} days ago`:
    days===0?'⚠️ Expires TODAY':days<=60?`📅 Expires in ${days} days (${form.leaseEnd})`:`✓ Active — ${days} days remaining`)

  const renewalDays = daysUntil(form.nextRenewalDate)
  const showRenewalBanner = !form.isMonthToMonth && form.nextRenewalDate && form.nextRenewalDate !== form.leaseEnd && renewalDays !== null && renewalDays <= 60
  const renewalColor = renewalDays<0?'#c62828':renewalDays<=14?'#e67e22':'#f1c40f'
  const renewalMsg = renewalDays<0?`⚠️ Renewal review OVERDUE by ${Math.abs(renewalDays)} days`:
    renewalDays===0?'🔔 Renewal review due TODAY':`🔔 Renewal review due in ${renewalDays} days (${form.nextRenewalDate})`

  // Tab list: Active + Notice Given by default, plus Signed Up / Completed
  // only if their respective tucked-away toggle is on. Past Tenants is
  // NOT a tab filter at all -- see TenancyHistoryCard, reached via its
  // own button per selected property regardless of that property's stage.
  const visibleProps = properties.filter(p => {
    if (getCountry(p, agreements) !== country) return false
    const stage = getStage(p.id, agreements)
    if (stage === 'Active' || stage === 'Notice Given') return true
    if (stage === 'Signed Up') return showSignedUp
    if (stage === 'Completed') return showCompleted
    return false
  })
  const signedUpCount  = properties.filter(p => getCountry(p,agreements)===country && getStage(p.id,agreements)==='Signed Up').length
  const completedCount = properties.filter(p => getCountry(p,agreements)===country && getStage(p.id,agreements)==='Completed').length

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Tenant agreements</div>
          <div className="topbar-sub">RENTAL PROPERTIES · LEASE DETAILS</div>
        </div>
        <div style={{width:34}}/>
      </div>

      <div className="screen-body">
        <div style={{display:'flex', gap:'8px', marginBottom:'14px'}}>
          {[{ key:'IN', label:'🇮🇳 India' }, { key:'US', label:'🇺🇸 USA' }].map(c => (
            <button key={c.key} onClick={()=>handleCountryChange(c.key)} style={{
              flex:1, padding:'10px', borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontSize:'0.85rem',
              border: country===c.key ? '2px solid #34A853' : '1px solid var(--border-dim)',
              background: country===c.key ? 'rgba(52,168,83,0.12)' : 'var(--dark-card)',
              color: country===c.key ? '#34A853' : 'var(--text-dim)',
            }}>{c.label}</button>
          ))}
        </div>

        <div style={{display:'flex',gap:'8px',marginBottom:'8px',alignItems:'stretch',flexWrap:'wrap'}}>
          {visibleProps.map(p => {
            const a = agreements[p.id]
            const stage = a?.stage || 'Signed Up'
            const d = (a?.lease_end && !a?.is_month_to_month) ? daysUntil(a.lease_end) : null
            const dot = d===null?null:d<0?'#c62828':d<=60?'#e67e22':'#34A853'
            return (
              <button key={p.id} onClick={()=>handlePropChange(p.id)} style={{
                flex:'1 1 100px', padding:'10px 6px',borderRadius:'10px',cursor:'pointer',textAlign:'center',
                border:selectedProp===p.id?'2px solid #185FA5':'1px solid var(--border-dim)',
                background:selectedProp===p.id?'rgba(24,95,165,0.12)':'var(--dark-card)',color:'var(--text)',
              }}>
                <div style={{fontWeight:'700',fontSize:'0.85rem'}}>{p.name}</div>
                <div style={{fontSize:'0.7rem',color:'var(--text-dim)',marginTop:'2px'}}>{p.location}</div>
                <div style={{fontSize:'0.62rem',color:STAGE_COLOR[stage],marginTop:'3px',fontWeight:'600'}}>
                  {a?.is_delinquent ? '⚠️ Delinquent' : stage}
                </div>
                {dot && <div style={{width:6,height:6,borderRadius:'50%',background:dot,margin:'4px auto 0'}}/>}
              </button>
            )
          })}
          <button onClick={()=>{ setNewProp(p=>({...p, country})); setShowAddProp(true) }} style={{
            width:40,flexShrink:0,borderRadius:'10px',cursor:'pointer',
            border:'1px dashed rgba(24,95,165,0.4)',background:'rgba(24,95,165,0.06)',
            color:'#185FA5',fontSize:'1.4rem',display:'flex',alignItems:'center',justifyContent:'center',
          }}>+</button>
        </div>

        {/* Tucked-away toggles for the rarely-checked ends of the lifecycle —
            NOT a filter row sitting at equal visual weight with the tabs above,
            on purpose, since these are checked far less often. */}
        <div style={{display:'flex', gap:'10px', marginBottom:'16px', fontSize:'0.72rem'}}>
          {signedUpCount > 0 && (
            <button onClick={()=>setShowSignedUp(v=>!v)} style={{
              background:'none', border:'none', cursor:'pointer', color: showSignedUp ? '#185FA5' : '#5C7080',
              textDecoration:'underline', textDecorationStyle:'dotted',
            }}>
              {showSignedUp ? '− Hide' : '+ Show'} Signed Up ({signedUpCount})
            </button>
          )}
          {completedCount > 0 && (
            <button onClick={()=>setShowCompleted(v=>!v)} style={{
              background:'none', border:'none', cursor:'pointer', color: showCompleted ? '#5C7080' : '#5C7080',
              textDecoration:'underline', textDecorationStyle:'dotted', opacity:0.8,
            }}>
              {showCompleted ? '− Hide' : '+ Show'} Completed / Term Ended ({completedCount})
            </button>
          )}
        </div>

        {showAddProp && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
            <div style={{background:'var(--dark-card)',borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'360px',border:'1px solid rgba(24,95,165,0.2)'}}>
              <div style={{color:'#85B7EB',fontWeight:'700',fontSize:'1rem',marginBottom:'16px'}}>Add New Property</div>
              {[{key:'name',ph:'e.g. Tritvam 2'},{key:'location',ph:'e.g. Kochi, KL'}].map(f=>(
                <div key={f.key} style={{marginBottom:'12px'}}>
                  <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginBottom:'6px',letterSpacing:'1px'}}>{f.key.toUpperCase()}</div>
                  <input value={newProp[f.key]} onChange={e=>setNewProp(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.ph} style={{width:'100%',background:'var(--dark)',border:'1px solid var(--border-dim)',borderRadius:'8px',padding:'10px 12px',color:'var(--text)',fontSize:'0.9rem',boxSizing:'border-box'}}/>
                </div>
              ))}
              <div className="grid-2" style={{marginBottom:'16px'}}>
                <div>
                  <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginBottom:'6px',letterSpacing:'1px'}}>COUNTRY</div>
                  <select value={newProp.country} onChange={e=>setNewProp(p=>({...p,country:e.target.value,currency:e.target.value==='US'?'USD':'INR'}))}
                    style={{width:'100%',background:'var(--dark)',border:'1px solid var(--border-dim)',borderRadius:'8px',padding:'10px 12px',color:'var(--text)',fontSize:'0.9rem',boxSizing:'border-box'}}>
                    <option value="IN">India (₹)</option>
                    <option value="US">USA ($)</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginBottom:'6px',letterSpacing:'1px'}}>CURRENCY</div>
                  <select value={newProp.currency} onChange={e=>setNewProp(p=>({...p,currency:e.target.value}))}
                    style={{width:'100%',background:'var(--dark)',border:'1px solid var(--border-dim)',borderRadius:'8px',padding:'10px 12px',color:'var(--text)',fontSize:'0.9rem',boxSizing:'border-box'}}>
                    <option value="INR">INR ₹</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
              </div>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>{setShowAddProp(false);setNewProp({name:'',location:'',country:'IN',currency:'INR'})}}
                  style={{flex:1,padding:'10px',borderRadius:'8px',border:'1px solid var(--border-dim)',background:'transparent',color:'var(--text-dim)',cursor:'pointer'}}>Cancel</button>
                <button onClick={handleAddProperty} disabled={addingProp||!newProp.name.trim()}
                  style={{flex:2,padding:'10px',borderRadius:'8px',border:'none',background:'#185FA5',color:'#fff',fontWeight:'700',cursor:'pointer',opacity:addingProp||!newProp.name.trim()?0.6:1}}>
                  {addingProp?'Adding…':'Add Property'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && <div style={{textAlign:'center',color:'var(--text-dim)',padding:'24px'}}>Loading…</div>}

        {!loading && visibleProps.length === 0 && (
          <div className="card-dashed" onClick={()=>{ setNewProp(p=>({...p, country})); setShowAddProp(true) }} style={{cursor:'pointer', textAlign:'center', padding:'28px 16px'}}>
            <div className="card-dashed-icon" style={{fontSize:'1.8rem', marginBottom:'8px'}}>
              {country === 'US' ? '🇺🇸' : '🇮🇳'}
            </div>
            <div className="card-dashed-text">
              <strong>No {country === 'US' ? 'USA' : 'India'} properties yet</strong>
              <span>{country === 'US'
                ? 'Add your first US property to get started — note that US lease document generation isn\u2019t set up yet.'
                : 'Tap to add a property in this country.'}</span>
            </div>
          </div>
        )}

        {!loading && selectedProp && prop && (
          <>
            {/* TENANT STAGE — this is the action that SAVES. Visually and
                verbally distinct from the property-tab list above, which
                only filters what's shown and saves nothing. */}
            <div className="card-section-label">{prop?.name?.toUpperCase()} · {prop?.location} — TENANT STAGE</div>
            <div style={{display:'flex',gap:'6px',marginBottom:'8px',flexWrap:'wrap'}}>
              {STAGES.map(s => (
                <button key={s} onClick={()=>handleStageChange(s)} style={{
                  padding:'5px 12px',borderRadius:'20px',cursor:'pointer',fontSize:'0.72rem',fontWeight:'600',
                  border:`1px solid ${form.stage===s?STAGE_COLOR[s]:'rgba(255,255,255,0.1)'}`,
                  background:form.stage===s?`${STAGE_COLOR[s]}22`:'transparent',
                  color:form.stage===s?STAGE_COLOR[s]:'#5C7080',
                }}>{s}</button>
              ))}
            </div>

            {form.stage === 'Completed' && (
              <div style={{marginBottom:'12px'}}>
                <div style={{fontSize:'0.68rem', color:'var(--text-dim)', marginBottom:'6px'}}>How did this tenancy end?</div>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                  {END_REASONS.map(r => (
                    <button key={r} onClick={()=>handleEndReasonChange(r)} style={{
                      padding:'5px 10px',borderRadius:'20px',cursor:'pointer',fontSize:'0.68rem',fontWeight:'600',
                      border:`1px solid ${form.endReason===r?'#EF4444':'rgba(255,255,255,0.1)'}`,
                      background:form.endReason===r?'rgba(239,68,68,0.14)':'transparent',
                      color:form.endReason===r?'#EF4444':'#5C7080',
                    }}>{r}</button>
                  ))}
                </div>
                {!form.endReason && (
                  <div style={{fontSize:'0.68rem', color:'#F59E0B', marginTop:'6px'}}>Pick a reason to confirm — not saved until you do.</div>
                )}
              </div>
            )}

            {(form.stage === 'Active' || form.stage === 'Notice Given') && (
              <button onClick={handleDelinquentToggle} style={{
                display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px', borderRadius:'20px',
                marginBottom:'14px', cursor:'pointer', fontSize:'0.78rem', fontWeight:'600',
                border:`1px solid ${form.isDelinquent?'#EF4444':'var(--border-dim)'}`,
                background: form.isDelinquent?'rgba(239,68,68,0.12)':'transparent',
                color: form.isDelinquent?'#EF4444':'var(--text-dim)',
              }}>
                {form.isDelinquent ? '⚠️ Behind on rent — tap to clear' : '☐ Mark behind on rent'}
              </button>
            )}

            {expiryMsg && (
              <div style={{background:`${expiryColor}18`,border:`1px solid ${expiryColor}55`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',color:expiryColor,fontSize:'0.85rem',fontWeight:'600'}}>
                {expiryMsg}
              </div>
            )}

            {showRenewalBanner && (
              <div style={{background:`${renewalColor}18`,border:`1px solid ${renewalColor}55`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',color:renewalColor,fontSize:'0.85rem',fontWeight:'600'}}>
                {renewalMsg}
              </div>
            )}

            {saved && form.leaseEnd && (form.stage === 'Active' || form.stage === 'Notice Given') && (
              <button onClick={handleRenewContract} style={{
                width:'100%', padding:'10px 14px', borderRadius:'10px', marginBottom:'12px', cursor:'pointer',
                border:'1px solid rgba(52,168,83,0.4)', background:'rgba(52,168,83,0.1)',
                color:'#34A853', fontWeight:'700', fontSize:'0.85rem',
              }}>
                🔄 Renew contract (+11 months)
              </button>
            )}

            {/* Close out with no replacement lined up yet — archives the
                tenant to Past Tenants and clears this property to vacant,
                separate from Incoming Tenant's "Move In Now" swap (which
                requires a queued replacement already on file). */}
            {saved && form.tenantName && (form.stage === 'Active' || form.stage === 'Notice Given') && (
              !closingOut ? (
                <button onClick={()=>{ setClosingOut(true); setCloseOutReason('') }} style={{
                  width:'100%', padding:'10px 14px', borderRadius:'10px', marginBottom:'12px', cursor:'pointer',
                  border:'1px solid rgba(239,68,68,0.35)', background:'rgba(239,68,68,0.08)',
                  color:'#EF4444', fontWeight:'700', fontSize:'0.85rem',
                }}>
                  🚪 Close out — no new tenant yet
                </button>
              ) : (
                <div style={{padding:'14px', borderRadius:'10px', marginBottom:'12px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.3)'}}>
                  <div style={{fontSize:'0.8rem', fontWeight:'700', color:'#EF4444', marginBottom:'8px'}}>
                    How did this tenancy end?
                  </div>
                  <div style={{display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'10px'}}>
                    {END_REASONS.map(r => (
                      <button key={r} onClick={()=>setCloseOutReason(r)} style={{
                        padding:'5px 10px', borderRadius:'20px', cursor:'pointer', fontSize:'0.68rem', fontWeight:'600',
                        border:`1px solid ${closeOutReason===r?'#EF4444':'rgba(255,255,255,0.1)'}`,
                        background: closeOutReason===r?'rgba(239,68,68,0.14)':'transparent',
                        color: closeOutReason===r?'#EF4444':'#5C7080',
                      }}>{r}</button>
                    ))}
                  </div>
                  <div style={{fontSize:'0.74rem', color:'var(--text-dim)', marginBottom:'10px'}}>
                    This archives <strong>{form.tenantName}</strong> to Past Tenants and clears {prop?.name} to vacant.
                    You can enter a new tenant here whenever one's ready. This can't be undone from here.
                  </div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <button onClick={()=>setClosingOut(false)} style={{flex:1, padding:'9px', borderRadius:'8px', border:'1px solid var(--border-dim)', background:'transparent', color:'var(--text-dim)', cursor:'pointer'}}>
                      Cancel
                    </button>
                    <button onClick={handleCloseOut} disabled={!closeOutReason || closeOutBusy} style={{
                      flex:1, padding:'9px', borderRadius:'8px', border:'none', background:'#EF4444', color:'#fff',
                      fontWeight:'700', cursor:'pointer', opacity: (!closeOutReason || closeOutBusy) ? 0.6 : 1,
                    }}>
                      {closeOutBusy ? 'Closing out…' : 'Confirm Close Out'}
                    </button>
                  </div>
                </div>
              )
            )}

            <TenantProfileCard form={form} setField={setField} onTenantNameChange={handleTenantNameChange} readOnly={false}/>

            <div className="card">
              <div className="card-section-label">Lease Terms (editable)</div>
              <div className="grid-2">
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>SECURITY DEPOSIT ({form.currency==='USD'?'$':'₹'})</label>
                  <input type="number" min="0" value={form.deposit} onChange={e=>setField('deposit',e.target.value)}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>RENT / MONTH ({form.currency==='USD'?'$':'₹'})</label>
                  <input type="number" min="0" value={form.agreedRent} onChange={e=>setField('agreedRent',e.target.value)}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'#34A853',fontSize:'0.9rem'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>MAINTENANCE ({form.currency==='USD'?'$':'₹'})</label>
                  <input type="number" min="0" value={form.maintenance} onChange={e=>setField('maintenance',e.target.value)}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>TOTAL MONTHLY ({form.currency==='USD'?'$':'₹'})</label>
                  <div style={{padding:'9px 12px',borderRadius:'8px',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'#C8903A',fontWeight:'700',display:'flex',alignItems:'center',fontSize:'0.9rem'}}>
                    {((parseFloat(form.agreedRent)||0)+(parseFloat(form.maintenance)||0)) > 0
                      ? (form.currency==='USD' ? `$${((parseFloat(form.agreedRent)||0)+(parseFloat(form.maintenance)||0)).toLocaleString()}` : `₹${((parseFloat(form.agreedRent)||0)+(parseFloat(form.maintenance)||0)).toLocaleString('en-IN')}`)
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{marginTop:'10px'}}>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>LEASE START *</label>
                  <input type="date" value={form.leaseStart} onChange={e=>setField('leaseStart',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>LEASE END *</label>
                  <input type="date" value={form.leaseEnd} onChange={e=>setField('leaseEnd',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                </div>
              </div>
              {duration && <div style={{color:'#C8903A',fontSize:'0.75rem',marginTop:'4px',opacity:0.8}}>Duration: {duration} months</div>}

              <div className="grid-2" style={{marginTop:'10px'}}>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>NEXT RENEWAL DATE</label>
                  <input type="date" value={form.nextRenewalDate} onChange={e=>setField('nextRenewalDate',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                  <div style={{fontSize:'0.65rem',color:'#5C7080',marginTop:'4px'}}>Defaults to lease end if left blank.</div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>EARLY TERMINATION DATE</label>
                  <input type="date" value={form.earlyTerminationDate} disabled={!form.earlyTerminated}
                    onChange={e=>setField('earlyTerminationDate',e.target.value)}
                    style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem',opacity:!form.earlyTerminated?0.4:1}}/>
                </div>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'10px',cursor:'pointer'}}>
                <input type="checkbox" checked={form.earlyTerminated}
                  onChange={e=>setField('earlyTerminated', e.target.checked)} style={{width:16,height:16}}/>
                <span style={{fontSize:'0.82rem',color: form.earlyTerminated ? '#EF4444' : 'var(--text-dim)'}}>
                  Lease was terminated early
                </span>
              </label>

              <label style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'10px',cursor:'pointer'}}>
                <input type="checkbox" checked={form.isMonthToMonth}
                  onChange={e=>setField('isMonthToMonth', e.target.checked)} style={{width:16,height:16}}/>
                <span style={{fontSize:'0.82rem',color: form.isMonthToMonth ? '#185FA5' : 'var(--text-dim)'}}>
                  Now on month-to-month (no fixed end date — hides expiry/renewal warnings below)
                </span>
              </label>
              {form.isMonthToMonth && (
                <div style={{marginTop:'8px', marginLeft:'24px'}}>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>MONTH-TO-MONTH SINCE *</label>
                  <input type="date" value={form.monthToMonthSince} onChange={e=>setField('monthToMonthSince',e.target.value)}
                    style={{width:'100%',maxWidth:'220px',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                  <div style={{fontSize:'0.65rem',color:'#5C7080',marginTop:'4px'}}>
                    Original lease end ({form.leaseEnd || '—'}) is kept for reference, not erased.
                  </div>
                </div>
              )}

              <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px',marginTop:'14px'}}>DOCUMENTS ON FILE</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'4px'}}>
                {[
                  { key:'docContractSigned', label:'📝 Contract signed' },
                  { key:'docIdCaptured',     label:'🪪 ID captured' },
                  { key:'docMoveIn',         label:'🔑 Move-in doc' },
                  { key:'docMoveOut',        label:'📦 Move-out doc' },
                  { key:'docDamageReport',   label:'⚠️ Damage report' },
                ].map(item => (
                  <label key={item.key} onClick={()=>handleDocToggle(item.key, form[item.key])} style={{
                    display:'flex', alignItems:'center', gap:'8px', cursor:'pointer',
                    padding:'8px 10px', borderRadius:'8px',
                    background: form[item.key] ? 'rgba(52,168,83,0.1)' : 'var(--dark-input)',
                    border: `1px solid ${form[item.key] ? 'rgba(52,168,83,0.35)' : 'var(--border-dim)'}`,
                  }}>
                    <input type="checkbox" checked={form[item.key]} onChange={()=>{}} style={{width:15,height:15,flexShrink:0}}/>
                    <span style={{fontSize:'0.78rem', color: form[item.key] ? '#34A853' : 'var(--text-dim)'}}>{item.label}</span>
                  </label>
                ))}
              </div>

              {error && <div style={{color:'#EF9A9A',fontSize:'0.82rem',marginTop:'10px',background:'rgba(198,40,40,0.1)',padding:'8px 10px',borderRadius:'8px'}}>❌ {error}</div>}
            </div>

            {/* ── MOVE-OUT CHECKLIST — filled in as the tenant is leaving,
                whether or not a replacement is lined up yet. Saved via the
                same Save button below; archived alongside the tenant's
                record when Close Out runs. ───────────────────────────── */}
            <div className="card" style={{marginTop:'12px'}}>
              <div className="card-section-label">🚚 Move-Out Checklist</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'4px',marginBottom:'12px'}}>
                {[
                  { key:'moveOutDocShared',    label:'📤 Move-out doc shared' },
                  { key:'moveOutDocsReceived', label:'📥 Received move-out docs' },
                ].map(item => (
                  <label key={item.key} onClick={()=>setField(item.key, !form[item.key])} style={{
                    display:'flex', alignItems:'center', gap:'8px', cursor:'pointer',
                    padding:'8px 10px', borderRadius:'8px',
                    background: form[item.key] ? 'rgba(52,168,83,0.1)' : 'var(--dark-input)',
                    border: `1px solid ${form[item.key] ? 'rgba(52,168,83,0.35)' : 'var(--border-dim)'}`,
                  }}>
                    <input type="checkbox" checked={form[item.key]} onChange={()=>{}} style={{width:15,height:15,flexShrink:0}}/>
                    <span style={{fontSize:'0.78rem', color: form[item.key] ? '#34A853' : 'var(--text-dim)'}}>{item.label}</span>
                  </label>
                ))}
              </div>
              <div className="grid-2">
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>
                    REPAIRS / DAMAGE CHARGES DEDUCTED ({form.currency==='USD'?'$':'₹'})
                  </label>
                  <input type="number" min="0" value={form.damageChargesDeducted} onChange={e=>setField('damageChargesDeducted',e.target.value)}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'var(--text)',fontSize:'0.9rem'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>
                    DEPOSIT AMOUNT PAID BACK ({form.currency==='USD'?'$':'₹'})
                  </label>
                  <input type="number" min="0" value={form.depositRefunded} onChange={e=>setField('depositRefunded',e.target.value)}
                    placeholder="0" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',boxSizing:'border-box',background:'var(--dark-input)',border:'1px solid var(--border-dim)',color:'#34A853',fontSize:'0.9rem'}}/>
                </div>
              </div>
              {parseFloat(form.deposit) > 0 && (
                <div style={{fontSize:'0.68rem',color:'#5C7080',marginTop:'6px'}}>
                  Deposit on file: {form.currency==='USD'?'$':'₹'}{Number(form.deposit).toLocaleString()}
                  {parseFloat(form.damageChargesDeducted) > 0 && ` − ${form.currency==='USD'?'$':'₹'}${Number(form.damageChargesDeducted).toLocaleString()} deducted`}
                  {' = '}{form.currency==='USD'?'$':'₹'}{Math.max(0, (parseFloat(form.deposit)||0) - (parseFloat(form.damageChargesDeducted)||0)).toLocaleString()} expected back
                </div>
              )}
            </div>

            {/* ── CAR PARKING SUB-TENANCY ─────────────────────────────── */}
            <div className="card" style={{marginTop:'12px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'2px'}}>
                <span style={{fontSize:'0.82rem',fontWeight:'700',color:'var(--text)',letterSpacing:'0.3px'}}>🅿️ Separate Car Parking Tenancy</span>
                <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                  <input type="checkbox" checked={form.hasSeparateParking}
                    onChange={e=>setField('hasSeparateParking', e.target.checked)}
                    style={{width:16,height:16}}/>
                  <span style={{fontSize:'0.78rem',color:'var(--text-dim)'}}>Enabled</span>
                </label>
              </div>
              <div style={{fontSize:'0.72rem',color:'var(--text-dim)',marginBottom:'10px'}}>
                Car park rented to a different person than the apartment tenant.
              </div>

              {form.hasSeparateParking && (<>
                <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>PARKING TENANT NAME</label>
                <input className="field-input" style={{width:'100%',marginBottom:'10px'}}
                  value={form.parkingTenantName} placeholder="Tenant name"
                  onChange={e=>setField('parkingTenantName',e.target.value)}/>

                <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>PARKING TENANT PHONE</label>
                <input className="field-input" style={{width:'100%',marginBottom:'10px'}}
                  value={form.parkingTenantPhone} placeholder="+91 XXXXX XXXXX"
                  onChange={e=>setField('parkingTenantPhone',e.target.value)}/>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                  <div>
                    <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>
                      MONTHLY FEE ({form.parkingCurrency === 'USD' ? '$' : '₹'})
                    </label>
                    <input className="field-input" style={{width:'100%'}} type="number" min="0"
                      value={form.parkingFee} placeholder="0"
                      onChange={e=>setField('parkingFee',e.target.value)}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>DEPOSIT</label>
                    <input className="field-input" style={{width:'100%'}} type="number" min="0"
                      value={form.parkingDeposit} placeholder="0"
                      onChange={e=>setField('parkingDeposit',e.target.value)}/>
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'4px'}}>
                  <div>
                    <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>LEASE START</label>
                    <input className="field-input" style={{width:'100%'}} type="date"
                      value={form.parkingLeaseStart}
                      onChange={e=>setField('parkingLeaseStart',e.target.value)}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'0.7rem',color:'var(--text-dim)',letterSpacing:'1px',marginBottom:'4px'}}>LEASE END</label>
                    <input className="field-input" style={{width:'100%'}} type="date"
                      value={form.parkingLeaseEnd}
                      onChange={e=>setField('parkingLeaseEnd',e.target.value)}/>
                  </div>
                </div>

                {/* Paid in full toggle */}
                <div style={{marginTop:'12px',padding:'10px 12px',borderRadius:'8px',
                  background: form.parkingPaidInFull ? 'rgba(52,168,83,0.08)' : 'var(--dark-input)',
                  border:`1px solid ${form.parkingPaidInFull ? 'rgba(52,168,83,0.3)' : 'var(--border-dim)'}`}}>
                  <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer'}}>
                    <input type="checkbox" checked={form.parkingPaidInFull}
                      onChange={e=>setField('parkingPaidInFull', e.target.checked)}
                      style={{width:16,height:16,flexShrink:0}}/>
                    <div>
                      <div style={{fontSize:'0.82rem',fontWeight:'600',color: form.parkingPaidInFull ? '#34A853' : 'var(--text)'}}>
                        Paid full term in advance
                      </div>
                      <div style={{fontSize:'0.7rem',color:'var(--text-dim)',marginTop:'2px'}}>
                        All months will be posted as paid when you save
                      </div>
                    </div>
                  </label>
                  {form.parkingPaidInFull && form.parkingFee && form.parkingLeaseStart && form.parkingLeaseEnd && (() => {
                    const [sy, sm] = form.parkingLeaseStart.split('-').map(Number)
                    const [ey, em] = form.parkingLeaseEnd.split('-').map(Number)
                    let count = 0, cy = sy, cm = sm
                    while (cy * 12 + cm <= ey * 12 + em) { count++; cm++; if (cm > 12) { cm=1; cy++ } }
                    const months = count
                    const total  = (parseFloat(form.parkingFee) || 0) * months
                    const sym    = form.parkingCurrency === 'USD' ? '$' : '₹'
                    return (
                      <div style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid rgba(52,168,83,0.2)',
                        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:'0.75rem',color:'var(--text-dim)'}}>
                          {sym}{parseFloat(form.parkingFee).toLocaleString()} × {months} months
                        </span>
                        <span style={{fontSize:'0.88rem',fontWeight:'700',color:'#34A853'}}>
                          {sym}{total.toLocaleString()} total
                        </span>
                      </div>
                    )
                  })()}
                </div>

                <div style={{fontSize:'0.7rem',color:'var(--text-dim)',marginTop:'8px'}}>
                  🔔 You'll get a renewal alert 30 days before the parking lease ends.
                </div>
              </>)}
            </div>

            <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : `💾 Save — ${prop?.name}`}
            </button>

            <DocumentEngineCard
              agreement={agreements[selectedProp]}
              property={prop}
              country={form.country}
              saved={saved}
              readOnly={false}
              showToast={showToast}
            />

            <FinancialsReceiptCard
              propId={selectedProp}
              agreement={agreements[selectedProp]}
              property={prop}
              saved={saved}
              readOnly={false}
              showToast={showToast}
            />

            <MetaDiagnosticsCard form={form} setField={setField} propName={prop?.name} readOnly={false}/>

            {/* Incoming Tenant — the forward-looking mirror of Past
                Tenants: a new tenant who's already signed/paid while the
                CURRENT tenant (above) is still living here, e.g. on
                Notice Given. rental_props only has one live slot, so this
                stays in its own table until "Move In Now" swaps them in. */}
            <IncomingTenantCard
              propId={selectedProp}
              propCountry={form.country}
              property={prop}
              currentTenantName={form.tenantName}
              showToast={showToast}
              onMovedIn={async () => {
                // Re-pull this property's agreement so the live form
                // immediately reflects the swap (new tenant, stage=Active)
                // rather than showing stale data until next reload.
                try {
                  const data = await api.getRentalAgreements()
                  const map = {}
                  ;(Array.isArray(data) ? data : []).forEach(a => { map[a.prop_id] = a })
                  setAgreements(map)
                  if (map[selectedProp]) prefill(map[selectedProp])
                } catch (e) { console.warn(e) }
              }}
            />

            {/* Past Tenants — a SEPARATE button, not a tab filter, since a
                property's live tenant can be Active while it separately
                has historic records on file. Tucked behind a toggle since
                this is checked rarely, mostly to cross-check old details. */}
            {!showHistory ? (
              <button onClick={()=>setShowHistory(true)} style={{
                width:'100%', marginTop:'4px', padding:'11px', borderRadius:'10px',
                border:'1px solid var(--border-dim)', background:'transparent',
                color:'var(--text-dim)', fontWeight:'600', fontSize:'0.82rem', cursor:'pointer',
              }}>
                📁 View Past Tenants for {prop?.name}
              </button>
            ) : (
              <>
                <button onClick={()=>setShowHistory(false)} style={{
                  background:'none', border:'none', cursor:'pointer', color:'#5C7080',
                  fontSize:'0.72rem', marginBottom:'8px', textDecoration:'underline',
                }}>
                  − Hide Past Tenants
                </button>
                <TenancyHistoryCard propId={selectedProp} propCountry={form.country} showToast={showToast}/>
              </>
            )}
          </>
        )}

        {toast && (
          <div style={{
            position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
            background: toast.type==='error' ? 'rgba(198,40,40,0.95)' : 'rgba(52,168,83,0.95)',
            color:'#fff', padding:'10px 20px', borderRadius:'10px', fontSize:'0.85rem', fontWeight:'600',
            boxShadow:'var(--shadow)', zIndex:300,
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  )
}
