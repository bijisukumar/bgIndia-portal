import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { AuthProvider, useAuth } from '../../hooks/useAuth'
import { restoreActiveVillaId, clearActiveVillaId } from '../../utils/villaContext'
import AccessDenied from '../../components/AccessDenied'
import '../../index.css'

// Root screens
import Login          from '../../screens/Login'
import PropertyPicker from '../../screens/PropertyPicker'
import OwnerHome      from '../../screens/OwnerHome'
import RDashboard         from '../../screens/RDashboard'

// Villa screens
import VillaHub          from '../../screens/villa/VillaHub'
import CompleteBooking    from '../../screens/villa/CompleteBooking'
import VillaDashboard    from '../../screens/villa/VillaDashboard'
import NewBooking        from '../../screens/villa/NewBooking'
import GuestRepository      from '../../screens/villa/GuestRepository'
import MarketingCampaigns   from '../../screens/villa/MarketingCampaigns'
import AgentLinks           from '../../screens/villa/AgentLinks'
import Inventory         from '../../screens/villa/Inventory'
import PreferredStock    from '../../screens/villa/PreferredStock'
import VillaExpenses     from '../../screens/villa/VillaExpenses'
import NotificationSettings from '../../screens/villa/NotificationSettings'
import EnquiryTracker    from '../../screens/villa/EnquiryTracker'
import NewEnquiry        from '../../screens/villa/NewEnquiry'
import EnquiryDetail     from '../../screens/villa/EnquiryDetail'
import EnquiryConversionDashboard from '../../screens/villa/EnquiryConversionDashboard'

// Rental screens
import RentalProperties from '../../screens/rental/RentalProperties'
import RentalAgreement  from '../../screens/rental/RentalAgreement'

// Estate screens
import PollachiHub    from '../../screens/estates/PollachiHub'
import CoconutTracker from '../../screens/estates/CoconutTracker'
import CoconutDashboard from '../../screens/estates/CoconutDashboard'
import IrrigationLog  from '../../screens/estates/IrrigationLog'
import MangoHarvest   from '../../screens/estates/MangoHarvest'
import PavutumuriHub  from '../../screens/estates/PavutumuriHub'
import RubberTracker  from '../../screens/estates/RubberTracker'
import RubberDashboard from '../../screens/estates/RubberDashboard'
import ManagerSettlement from '../../screens/estates/ManagerSettlement'
import EstateLedger   from '../../screens/estates/EstateLedger'

// Infra / ops screens
import DebugPanel        from '../../screens/infra/DebugPanel'
import TestRunner        from '../../screens/infra/TestRunner'
import D1Explorer        from '../../screens/infra/D1Explorer'
import Maintenance       from '../../screens/infra/Maintenance'
import SchemaValidation  from '../../screens/infra/SchemaValidation'

function ProtectedRoutes() {
  const { user } = useAuth()
  // A tenant with just 1 property (today's real Dwarka case) never sees
  // this — restoreActiveVillaId() resolves instantly from a prior pick
  // this session, or the picker resolves it in one round-trip on first
  // load and it's never shown again until "Switch property" is used.
  const [resolved, setResolved] = useState(() => !!restoreActiveVillaId())

  if (!user) return <Navigate to="/login" replace />
  // manage.* is the super-user console — only master_owner gets in.
  // Every other role (including a tenant's own owner/manager PIN) has
  // its own dedicated app (stayvibe.*/estate360.*/rev360.*) instead.
  if (user.role !== 'master_owner') return <AccessDenied />
  if (!resolved) return <PropertyPicker onResolved={() => setResolved(true)} />

  const showSwitcher = user.propertyIds == null || (user.propertyIds && user.propertyIds.length > 1)

  return (
    <>
    {showSwitcher && (
      <button
        onClick={() => { clearActiveVillaId(); setResolved(false) }}
        style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000,
          background: 'rgba(200,144,58,0.15)', border: '1px solid rgba(200,144,58,0.4)',
          borderRadius: '8px', color: '#C8903A', fontSize: '0.7rem', fontWeight: '700',
          padding: '6px 10px', cursor: 'pointer' }}>
        ⇄ Switch property
      </button>
    )}
    <Routes>
      {/* Only master_owner ever reaches here (gated above) — always true,
          kept explicit rather than an unconditional fragment. */}
      {user.role === 'master_owner' && <>
        <Route path="/"                       element={<OwnerHome />} />
        {/* Villa */}
        <Route path="/owner/villa"            element={<VillaHub />} />
        <Route path="/owner/villa/booking"    element={<NewBooking />} />
        <Route path="/owner/villa/income"     element={<CompleteBooking />} />
        <Route path="/owner/villa/dashboard"  element={<VillaDashboard />} />
        <Route path="/owner/villa/inventory"  element={<Inventory />} />
        <Route path="/raman/inventory"        element={<Inventory />} />
        <Route path="/owner/villa/expenses"   element={<VillaExpenses />} />
        <Route path="/owner/villa/notifications" element={<NotificationSettings />} />
        <Route path="/owner/villa/inventory/preferred-stock"  element={<PreferredStock />} />
        <Route path="/owner/villa/enquiries"                  element={<EnquiryTracker />} />
        <Route path="/owner/villa/enquiries/new"               element={<NewEnquiry />} />
        <Route path="/owner/villa/enquiries/dashboard"         element={<EnquiryConversionDashboard />} />
        <Route path="/owner/villa/enquiries/:enquiryId/edit"   element={<NewEnquiry />} />
        <Route path="/owner/villa/enquiries/:enquiryId"        element={<EnquiryDetail />} />
        <Route path="/owner/guests"           element={<GuestRepository />} />
        <Route path="/owner/r-dashboard"      element={<RDashboard />} />
        {/* Rental */}
        <Route path="/owner/rental"           element={<RentalProperties />} />
        <Route path="/owner/rental/agreement" element={<RentalAgreement />} />
        {/* Estates */}
        <Route path="/owner/pollachi"         element={<PollachiHub />} />
        <Route path="/pollachi/coconut"       element={<CoconutTracker />} />
        <Route path="/pollachi/dashboard"     element={<CoconutDashboard />} />
        <Route path="/pollachi/ledger"        element={<EstateLedger estate="pollachi" />} />
        <Route path="/pollachi/irrigation"    element={<IrrigationLog estate="pollachi" />} />
        <Route path="/pollachi/mango"         element={<MangoHarvest estate="pollachi" />} />
        <Route path="/owner/pavutumuri"       element={<PavutumuriHub />} />
        <Route path="/pavutumuri/rubber"      element={<RubberTracker />} />
        <Route path="/pavutumuri/dashboard"   element={<RubberDashboard />} />
        <Route path="/pavutumuri/settlement"  element={<ManagerSettlement estate="pavutumuri" />} />
        <Route path="/pavutumuri/ledger"      element={<EstateLedger estate="pavutumuri" />} />
        {/* Infra */}
        <Route path="/debug"                  element={<DebugPanel />} />
        <Route path="/test"                   element={<TestRunner />} />
        <Route path="/owner/maintenance"      element={<Maintenance />} />
        <Route path="/owner/maintenance/schema" element={<SchemaValidation />} />
        <Route path="/owner/marketing"            element={<MarketingCampaigns />} />
        <Route path="/owner/villa/agent-links"    element={<AgentLinks />} />
        <Route path="/infra/d1"               element={<D1Explorer />} />
      </>}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginGate />} />
          <Route path="/*"     element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function LoginGate() {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />
  return <Login />
}
