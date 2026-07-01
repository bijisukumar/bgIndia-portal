// ============================================================
//  ESTATE360 — Estate Management App
//  Serves: estate360.luxuryvillasofguruvayur.com
//  Screens: Pollachi (coconut) + Pavutumuri (rubber)
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '../../hooks/useAuth'
import '../../index.css'

import Login           from '../../screens/Login'
import OwnerHome       from '../../screens/OwnerHome'
import EstateManagerHome from '../../screens/EstateManagerHome'
import PollachiHub     from '../../screens/estates/PollachiHub'
import CoconutTracker  from '../../screens/estates/CoconutTracker'
import CoconutDashboard from '../../screens/estates/CoconutDashboard'
import PavutumuriHub   from '../../screens/estates/PavutumuriHub'
import RubberTracker   from '../../screens/estates/RubberTracker'
import RubberDashboard from '../../screens/estates/RubberDashboard'
import ManagerSettlement from '../../screens/estates/ManagerSettlement'
import EstateLedger    from '../../screens/estates/EstateLedger'
import IrrigationLog   from '../../screens/estates/IrrigationLog'
import MangoHarvest    from '../../screens/estates/MangoHarvest'
import D1Explorer      from '../../screens/infra/D1Explorer'

function ProtectedRoutes() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const role = user.role

  return (
    <Routes>
      {role === 'owner' && <>
        <Route path="/"                       element={<OwnerHome />} />
        <Route path="/owner/pollachi"         element={<PollachiHub />} />
        <Route path="/pollachi/coconut"       element={<CoconutTracker />} />
        <Route path="/pollachi/dashboard"     element={<CoconutDashboard />} />
        <Route path="/pollachi/ledger"        element={<EstateLedger estate="pollachi" />} />
        <Route path="/pollachi/irrigation"     element={<IrrigationLog estate="pollachi" />} />
        <Route path="/pollachi/mango"          element={<MangoHarvest estate="pollachi" />} />
        <Route path="/owner/pavutumuri"       element={<PavutumuriHub />} />
        <Route path="/pavutumuri/rubber"      element={<RubberTracker />} />
        <Route path="/pavutumuri/dashboard"   element={<RubberDashboard />} />
        <Route path="/pavutumuri/settlement"  element={<ManagerSettlement estate="pavutumuri" />} />
        <Route path="/pavutumuri/ledger"      element={<EstateLedger estate="pavutumuri" />} />
        <Route path="/infra/d1"               element={<D1Explorer />} />
      </>}

      {role === 'estate_manager' && <>
        <Route path="/"                         element={<EstateManagerHome />} />
        <Route path="/pollachi/coconut"         element={<CoconutTracker />} />
        <Route path="/pollachi/dashboard"       element={<CoconutDashboard />} />
        <Route path="/pollachi/ledger"          element={<EstateLedger estate="pollachi" />} />
        <Route path="/pollachi/irrigation"      element={<IrrigationLog estate="pollachi" />} />
        <Route path="/pollachi/mango"           element={<MangoHarvest estate="pollachi" />} />
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
