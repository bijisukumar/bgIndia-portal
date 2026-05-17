import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import './index.css'

// Root screens
import Login          from './screens/Login'
import OwnerHome      from './screens/OwnerHome'
import PradoshHome    from './screens/PradoshHome'
import RamanHome      from './screens/RamanHome'
import RDashboard     from './screens/RDashboard'

// Villa screens
import VillaHub          from './screens/villa/VillaHub'
import VillaRentalIncome from './screens/villa/VillaRentalIncome'
import VillaDashboard    from './screens/villa/VillaDashboard'
import NewBooking        from './screens/villa/NewBooking'
import CheckIn           from './screens/villa/CheckIn'
import KitchenIncidentals from './screens/villa/KitchenIncidentals'
import BreakfastEntry    from './screens/villa/BreakfastEntry'
import CarRentalEntry    from './screens/villa/CarRentalEntry'
import GuestRepository   from './screens/villa/GuestRepository'
import Inventory         from './screens/villa/Inventory'

// Rental screens
import RentalProperties from './screens/rental/RentalProperties'
import RentalAgreement  from './screens/rental/RentalAgreement'

// Estate screens
import PollachiHub    from './screens/estates/PollachiHub'
import CoconutTracker from './screens/estates/CoconutTracker'
import CoconutDashboard from './screens/estates/CoconutDashboard'
import PavutumuriHub  from './screens/estates/PavutumuriHub'
import RubberTracker  from './screens/estates/RubberTracker'
import EstateLedger   from './screens/estates/EstateLedger'

// Infra / ops screens
import DebugPanel  from './screens/infra/DebugPanel'
import TestRunner  from './screens/infra/TestRunner'
import D1Explorer  from './screens/infra/D1Explorer'

function ProtectedRoutes() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const role = user.role

  return (
    <Routes>
      {/* ── OWNER ──────────────────────────────────── */}
      {role === 'owner' && <>
        <Route path="/"                       element={<OwnerHome />} />
        {/* Villa */}
        <Route path="/owner/villa"            element={<VillaHub />} />
        <Route path="/owner/villa/booking"    element={<NewBooking />} />
        <Route path="/owner/villa/income"     element={<VillaRentalIncome />} />
        <Route path="/owner/villa/dashboard"  element={<VillaDashboard />} />
        <Route path="/owner/villa/inventory"  element={<Inventory />} />
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
        <Route path="/owner/pavutumuri"       element={<PavutumuriHub />} />
        <Route path="/pavutumuri/rubber"      element={<RubberTracker />} />
        <Route path="/pavutumuri/ledger"      element={<EstateLedger estate="pavutumuri" />} />
        {/* Infra */}
        <Route path="/debug"                  element={<DebugPanel />} />
        <Route path="/test"                   element={<TestRunner />} />
        <Route path="/infra/d1"               element={<D1Explorer />} />
      </>}

      {/* ── PRADOSH (estate manager) ───────────────── */}
      {role === 'estate_manager' && <>
        <Route path="/"                       element={<PradoshHome />} />
        <Route path="/pollachi/coconut"       element={<CoconutTracker />} />
        <Route path="/pollachi/ledger"        element={<EstateLedger estate="pollachi" />} />
        <Route path="/pollachi/dashboard"     element={<CoconutDashboard />} />
      </>}

      {/* ── RAMAN (villa manager) ──────────────────── */}
      {role === 'manager' && <>
        <Route path="/"                       element={<RamanHome />} />
        <Route path="/raman/checkin"          element={<CheckIn />} />
        <Route path="/raman/kitchen"          element={<KitchenIncidentals />} />
        <Route path="/raman/breakfast"        element={<BreakfastEntry />} />
        <Route path="/raman/carrental"        element={<CarRentalEntry />} />
        <Route path="/pavutumuri/rubber"      element={<RubberTracker />} />
        <Route path="/pavutumuri/ledger"      element={<EstateLedger estate="pavutumuri" />} />
      </>}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
