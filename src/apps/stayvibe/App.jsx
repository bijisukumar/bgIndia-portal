// ============================================================
//  STAYVIBE — Villa Management App
//  Serves: stayvibe.luxuryvillasofguruvayur.com
//          stayvibe-[clientid].luxuryvillasofguruvayur.com
//  Screens: Villa owner + Raman (villa manager)
//  Single DB, tenant isolated by auth token → villa_id
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '../../hooks/useAuth'
import '../../index.css'

// Auth
import Login from '../../screens/Login'

// Owner — villa screens only
import OwnerHome      from '../../screens/OwnerHome'
import VillaHub       from '../../screens/villa/VillaHub'
import VillaRentalIncome from '../../screens/villa/VillaRentalIncome'
import CompleteBooking from '../../screens/villa/CompleteBooking'
import VillaDashboard from '../../screens/villa/VillaDashboard'
import NewBooking     from '../../screens/villa/NewBooking'
import CheckIn        from '../../screens/villa/CheckIn'
import GuestRepository from '../../screens/villa/GuestRepository'
import Inventory      from '../../screens/villa/Inventory'
import RDashboard     from '../../screens/RDashboard'
import D1Explorer     from '../../screens/infra/D1Explorer'

// Manager (Raman) screens
import RamanHome          from '../../screens/RamanHome'
import KitchenIncidentals from '../../screens/villa/KitchenIncidentals'
import BreakfastEntry     from '../../screens/villa/BreakfastEntry'
import CarRentalEntry     from '../../screens/villa/CarRentalEntry'
import RDashboardSnapshot from '../../screens/RDashboardSnapshot'

function ProtectedRoutes() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const role = user.role

  return (
    <Routes>
      {/* ── OWNER ── */}
      {role === 'owner' && <>
        <Route path="/"                       element={<OwnerHome />} />
        <Route path="/owner/villa"            element={<VillaHub />} />
        <Route path="/owner/villa/booking"    element={<NewBooking />} />
        <Route path="/owner/villa/income"     element={<CompleteBooking />} />
        <Route path="/owner/villa/dashboard"  element={<VillaDashboard />} />
        <Route path="/owner/villa/inventory"  element={<Inventory />} />
        <Route path="/owner/guests"           element={<GuestRepository />} />
        <Route path="/owner/r-dashboard"      element={<RDashboard />} />
        <Route path="/infra/d1"               element={<D1Explorer />} />
      </>}

      {/* ── MANAGER (Raman) ── */}
      {role === 'manager' && <>
        <Route path="/"                       element={<RamanHome />} />
        <Route path="/raman/checkin"          element={<CheckIn />} />
        <Route path="/raman/kitchen"          element={<KitchenIncidentals />} />
        <Route path="/raman/breakfast"        element={<BreakfastEntry />} />
        <Route path="/raman/carrental"        element={<CarRentalEntry />} />
        <Route path="/raman/dashboard"        element={<RDashboardSnapshot />} />
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
