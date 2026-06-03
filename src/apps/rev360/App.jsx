// ============================================================
//  REV360 — Rental Property Management App
//  Serves: rev360.luxuryvillasofguruvayur.com
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '../../hooks/useAuth'
import '../../index.css'

import Login            from '../../screens/Login'
import Rev360Home       from '../../screens/Rev360Home'
import RentalProperties from '../../screens/rental/RentalProperties'
import RentalAgreement  from '../../screens/rental/RentalAgreement'
import ClaimsLedger     from '../../screens/rental/ClaimsLedger'
import ClaimsReport     from '../../screens/rental/ClaimsReport'
import PropertyDetails  from '../../screens/rental/PropertyDetails'
import D1Explorer       from '../../screens/infra/D1Explorer'

function ProtectedRoutes() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route path="/"                              element={<Rev360Home />} />
      <Route path="/owner/rental"                  element={<RentalProperties />} />
      <Route path="/owner/rental/agreement"        element={<RentalAgreement />} />
      <Route path="/owner/rental/claims"           element={<ClaimsLedger />} />
      <Route path="/owner/rental/claims/report"    element={<ClaimsReport />} />
      <Route path="/owner/rental/dashboard"        element={<RentalProperties />} />
      <Route path="/owner/rental/property"         element={<PropertyDetails />} />
      <Route path="/infra/d1"                      element={<D1Explorer />} />
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
