import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import './index.css'

// Screens
import Login          from './screens/Login'
import OwnerHome      from './screens/OwnerHome'
import PradoshHome    from './screens/PradoshHome'
import RamanHome      from './screens/RamanHome'
import VillaHub       from './screens/VillaHub'
import VillaRentalIncome from './screens/VillaRentalIncome'
import VillaDashboard from './screens/VillaDashboard'
import RentalProperties from './screens/RentalProperties'
import PollachiHub    from './screens/PollachiHub'
import CoconutTracker from './screens/CoconutTracker'
import PavutumuriHub  from './screens/PavutumuriHub'
import RubberTracker  from './screens/RubberTracker'
import EstateLedger   from './screens/EstateLedger'
import CoconutDashboard from './screens/CoconutDashboard'

function ProtectedRoutes() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  const role = user.role

  return (
    <Routes>
      {/* Owner */}
      {role === 'owner' && <>
        <Route path="/"                    element={<OwnerHome />} />
        <Route path="/owner/villa"         element={<VillaHub />} />
        <Route path="/owner/villa/income"  element={<VillaRentalIncome />} />
        <Route path="/owner/villa/dashboard" element={<VillaDashboard />} />
        <Route path="/owner/rental"        element={<RentalProperties />} />
        <Route path="/owner/pollachi"      element={<PollachiHub />} />
        <Route path="/owner/pavutumuri"    element={<PavutumuriHub />} />
        <Route path="/pollachi/coconut"    element={<CoconutTracker />} />
        <Route path="/pollachi/ledger"     element={<EstateLedger estate="pollachi" />} />
        <Route path="/pollachi/dashboard"  element={<CoconutDashboard />} />
        <Route path="/pavutumuri/rubber"   element={<RubberTracker />} />
        <Route path="/pavutumuri/ledger"   element={<EstateLedger estate="pavutumuri" />} />
      </>}

      {/* Pradosh */}
      {role === 'estate_manager' && <>
        <Route path="/"                   element={<PradoshHome />} />
        <Route path="/pollachi/coconut"   element={<CoconutTracker />} />
        <Route path="/pollachi/ledger"    element={<EstateLedger estate="pollachi" />} />
        <Route path="/pollachi/dashboard" element={<CoconutDashboard />} />
      </>}

      {/* Raman — simplified view */}
      {role === 'manager' && <>
        <Route path="/" element={<RamanHome />} />
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
